/**
 * reconcile.js
 * An implementation of the reconciliation algorithm presented by Facebook
 * react.js (https://facebook.github.io/react/docs/reconciliation.html). This
 * handles the diff between two nodes using the above algorithm. Additionally,
 * this library will generate the diff actions, and allow you to perform
 * a patch and applied Change using a three-way merge option.
 *
 * The MIT License (MIT)
 * Copyright (c) 2015 Thomas Holloway <nyxtom@gmail.com>
 */

/**
 * @typedef {{
 *    action: (string),
 *    element: (null|undefined|Node|Element|DocumentFragment),
 *    baseIndex: (null|undefined|string),
 *    sourceIndex: (null|undefined|string),
 *    _deleted: (null|undefined|string|number),
 *    _inserted: (null|undefined|string|number),
 *    _length: (null|undefined|string|number),
 *    name: (null|undefined|string|number)
 * }} Change
 *
 * @typedef {{
 *    map: Object,
 *    indices: Array<number>
 * }} MapElementsResult
 *
 * @typedef {{
 *    compare: Array<Array<Node|Element|DocumentFragment>>,
 *    diff: Array<Change>
 * }} MoveComparisonResult
 *
 * @typedef {{
 *    mine: Change,
 *    theirs: Change
 * }} ChangeConflict
 *
 * @typedef {{
 *    unapplied: Array<Change>,
 *    conflicts: Array<ChangeConflict>
 * }} ApplyResult
 *
 * @typedef {{
 *     lastParent: (null|undefined|Node|Element|DocumentFragment),
 *     lastParentIndex: (null|undefined|string),
 *     node: (null|undefined|Node|Element|DocumentFragment),
 *     found: (boolean)
 * }} FindNodeAtIndexResult
 *
 * @typedef {{
 *     parent: (Node|Element|DocumentFragment),
 *     insertion: (Node|Element|DocumentFragment),
 *     source: (null|undefined|Node|Element|DocumentFragment),
 *     change: Change,
 *     appendOnly: (boolean)
 * }} AppliedMoveAction
 */

'use strict';

/**
 * Simple escape utility for html entities.
 * @param {string} s
 * @return {string}
 */
function escape(s) {
    var n = s;
    n = n.replace(/&/g, '&amp;');
    n = n.replace(/</g, '&lt;');
    n = n.replace(/>/g, '&gt;');
    n = n.replace(/"/g, '&quot;');

    return n;
}

/**
 * Maps a list of nodes by their id or generated id.
 * @param {NodeList} nodes
 * @return {MapElementsResult}
 */
function mapElements(nodes) {
    var map = {};
    var tags = {};
    var node;

    var indices = [];
    for (var i = 0, len=nodes.length; i<len; i++) {
        node = nodes[i];
        var id = (node.id) ? node.id : generateId(node, tags);
        map[id] = node;
        node._i = i;
        node._id = id;
        indices.push(i);
    }

    return { 'map': map, 'indices': indices };
}

/**
 * Generates a unique id for a given node by its tag name and existing
 * tags used for disambiguation as well as a given counter per tag use.
 * @param {Node|Element|DocumentFragment} node
 * @param {Object} tags
 * @return {string}
 */
function generateId(node, tags) {
    // get the tag or create one from the other node types
    var tag = (node.tagName) ? node.tagName : 'x' + node.nodeType;

    // set the counter to zero
    if (!tags[tag]) {
        tags[tag] = 0;
    }

    // increment the counter for that tag
    tags[tag]++;

    return tag + tags[tag];
}

/**
 * Generate moves creates a diff for a given map, nodes and base element
 * to iterate over the elements in either forward or reverse order. This allows
 * us to determine whether the reverse or in order diff creates more or less moves.
 * Reducing the number of changes required for moves, insertions and deletions is
 * important to reducing future conflicts.
 *
 * @param {MapElementsResult} map
 * @param {NodeList} nodes
 * @param {Array<Number>} indices
 * @param {Node|Element|DocumentFragment} base
 * @param {boolean} reverse
 * @param {null|undefined|string} index
 * @return {MoveComparisonResult}
 */
function generateMoves(map, nodes, indices, base, reverse, index) {
    var moves = [];
    var compare = [];
    var operateMap = {};
    var tags = {};

    // iterate over the nodes and base nodes in the given order
    for (var i = 0, len = nodes.length; i < len; i++) {
        var node = nodes[reverse ? (nodes.length - i - 1) : i],
            bound = base.childNodes[reverse ? (base.childNodes.length - indices[i] - 1) : indices[i]],
            id = node.id ? node.id : generateId(node, tags);

        // skip if we already performed an insertion map
        if (operateMap[id]) {
            continue;
        }

        // check if the node has an id
        // if it exists in the base map, then move that node to the correct
        // position, this will usually be the same node, which means no dom move
        // is necessary, otherwise clone the node from the source (new inserts)
        var existing = map[id];
        if (existing) {
            if (existing !== bound) {
                var relativeBaseIndex = (reverse ? base.childNodes.length - existing._i - 1 : existing._i);
                moves.push({
                    'action': 'moveChildElement',
                    'element': existing,
                    'baseIndex': index + '>' + relativeBaseIndex,
                    'sourceIndex': index + '>' + i});

                // move the index so we can retrieve the next appropriate node
                indices.splice(i, 0, indices.splice(relativeBaseIndex, 1)[0]);
            }
            if (!node.isEqualNode(existing)) {
                compare.push([node, existing]);
            }
        } else {
            var inserted = node.cloneNode(true);
            var relativeBaseIndex = (reverse ? nodes.length - i - 1 : i);
            moves.push({
                'action': 'insertChildElement',
                'element': inserted,
                'baseIndex': index + '>' + relativeBaseIndex,
                'sourceIndex': index + '>' + relativeBaseIndex});
        }
        operateMap[id] = true;
    }

    // Remove any tail nodes in the base
    for (var i = 0, len = base.childNodes.length; i < len; i++) {
        var remove = base.childNodes[i];
        var removeId = remove._id;
        if (!operateMap[removeId]) {
            moves.push({
                'action': 'removeChildElement',
                'element': remove,
                'baseIndex': index + '>' + remove._i,
                'sourceIndex': null });
        }
    }

    return { 'compare': compare, 'diff': moves };
};


/**
 * Performs a simple diff between two different strings. The
 * result is an array of changes to be made at various indices
 * to transform base to source.
 *
 * Javascript Diff Algorithm
 *  By John Resig (http://ejohn.org/)
 *  Modified by Chu Alan "sprite"
 *  Modified by Thomas Holloway to support
 *  returning a list of diff changes for reconcile.js
 *
 * Released under the MIT license.
 *
 * More Info:
 *  http://ejohn.org/projects/javascript-diff-algorithm/
 *  http://ejohn.org/files/jsdiff.js
 *
 * @param {string} source
 * @param {string} base
 * @param {null|undefined|string} index
 * @param {null|undefined|Node|Element|DocumentFragment} baseElement
 * @return {Array<Change>}
 */
function diffString(source, base, index, baseElement) {
    var o = base == "" ? [] : base.split(/\s+/);
    var n = source == "" ? [] : source.split(/\s+/);
    var ns = new Object();
    var os = new Object();

    for (var i = 0; i < n.length; i++) {
        if (ns[n[i]] == null)
            ns[n[i]] = {
                rows: new Array(),
                o: null
            };
        ns[n[i]].rows.push(i);
    }

    for (var i = 0; i < o.length; i++) {
        if (os[o[i]] == null)
            os[o[i]] = {
                rows: new Array(),
                n: null
            };
        os[o[i]].rows.push(i);
    }

    for (var i in ns) {
        if (ns[i].rows.length == 1 && typeof(os[i]) != "undefined" && os[i].rows.length == 1) {
            n[ns[i].rows[0]] = {
                text: n[ns[i].rows[0]],
                row: os[i].rows[0]
            };
            o[os[i].rows[0]] = {
                text: o[os[i].rows[0]],
                row: ns[i].rows[0]
            };
        }
    }

    for (var i = 0; i < n.length - 1; i++) {
        if (n[i].text != null && n[i + 1].text == null && n[i].row + 1 < o.length && o[n[i].row + 1].text == null &&
            n[i + 1] == o[n[i].row + 1]) {
            n[i + 1] = {
                text: n[i + 1],
                row: n[i].row + 1
            };
            o[n[i].row + 1] = {
                text: o[n[i].row + 1],
                row: i + 1
            };
        }
    }

    for (var i = n.length - 1; i > 0; i--) {
        if (n[i].text != null && n[i - 1].text == null && n[i].row > 0 && o[n[i].row - 1].text == null &&
            n[i - 1] == o[n[i].row - 1]) {
            n[i - 1] = {
                text: n[i - 1],
                row: n[i].row - 1
            };
            o[n[i].row - 1] = {
                text: o[n[i].row - 1],
                row: i - 1
            };
        }
    }

    var oSpace = base.match(/\s+/g);
    if (oSpace == null) {
        oSpace = [''];
    } else {
        oSpace.push('');
    }
    var nSpace = source.match(/\s+/g);
    if (nSpace == null) {
        nSpace = [''];
    } else {
        nSpace.push('');
    }

    var changes = [];
    var baseIndex = 0;
    if (n.length == 0) {
        for (var i = 0; i < o.length; i++) {
            changes.push({
                'action': 'deleteText',
                'element': baseElement,
                'baseIndex': index,
                'sourceIndex': index,
                '_textStart': baseIndex,
                '_textEnd': baseIndex + o[i].length + oSpace[i].length,
                '_deleted': o[i] + oSpace[i],
                '_length': o[i].length + oSpace[i].length
            });
            baseIndex += o[i].length + oSpace[i].length;
        }
    } else {
        if (n[0].text == null) {
            for (var i = 0; i < o.length && o[i].text == null; i++) {
                changes.push({
                    'action': 'deleteText',
                    'element': baseElement,
                    'baseIndex': index,
                    'sourceIndex': index,
                    '_textStart': baseIndex,
                    '_textEnd': baseIndex + o[i].length + oSpace[i].length,
                    '_deleted': o[i] + oSpace[i],
                    '_length': o[i].length + oSpace[i].length
                });
                baseIndex += o[i].length + oSpace[i].length;
            }
        }

        var k = 0;
        for (var i = 0; i < n.length; i++) {
            if (n[i].text == null) {
                changes.push({
                    'action': 'insertText',
                    'element': baseElement,
                    'baseIndex': index,
                    'sourceIndex': index,
                    '_textStart': baseIndex,
                    '_textEnd': baseIndex + n[i].length + nSpace[i].length,
                    '_inserted': n[i] + nSpace[i],
                    '_length': n[i].length + nSpace[i].length
                });
                baseIndex += n[i].length + nSpace[i].length;
            } else {
                baseIndex += n[i].text.length + nSpace[i].length;
                // edge case for white space insertions
                if (n[k].text == null) {
                    continue;
                }
                for (k = n[k].row + 1; k < o.length && o[k].text == null; k++) {
                    changes.push({
                        'action': 'deleteText',
                        'element': baseElement,
                        'baseIndex': index,
                        'sourceIndex': index,
                        '_textStart': baseIndex,
                        '_textEnd': baseIndex + o[k].length + oSpace[k].length,
                        '_deleted': o[k] + oSpace[k],
                        '_length': o[k].length + oSpace[k].length
                    });
                    baseIndex += o[k].length + oSpace[k].length;
                }
            }
        }
    }

    return changes;
};

/**
 * Merges two given nodes by checking their content
 * node type, attribute differences and finally their
 * child nodes through various diff operations. This
 * will merge and return the diff as a list.
 * @param {Node|Element|DocumentFragment} source
 * @param {Node|Element|DocumentFragment} base
 * @param {null|undefined|string} index
 * @return {Array<Change>}
 */
function diff(source, base, index) {
    var diffActions = [];
    if (index == null) {
        index = '0'; // 0 for root node
    }
    // if the source and base is either a text node or a comment node,
    // then we can simply say the difference is their text content
    if (source.nodeType === base.nodeType && (source.nodeType === 3 || source.nodeType === 8)) {
        if (base.nodeValue !== source.nodeValue) {
            var textActions = diffString(source.nodeValue, base.nodeValue, index, base);
            if (textActions) {
                for (var i = 0; i < textActions.length; i++) {
                    textActions[i]['element'] = base;
                }
                diffActions = diffActions.concat(textActions);
            }
            /*
            diffActions.push({
                'action': 'replaceText',
                'element': base,
                'baseIndex': index,
                'sourceIndex': index,
                '_deleted': base.nodeValue,
                '_inserted': source.nodeValue });
            */
        }

        return diffActions;
    }

    // look for differences between the nodes by their attributes
    if (source.attributes && base.attributes) {
        var attributes = source.attributes,
            value,
            name;

        // iterate over the source attributes that we want to copy over to the new base node
        for (var i = attributes.length; i--; ) {
            value = attributes[i].nodeValue;
            name = attributes[i].nodeName;

            var val = base.getAttribute(name);
            if (val !== value) {
                if (val == null) {
                    diffActions.push({
                        'action': 'setAttribute',
                        'name': name,
                        'element': base,
                        'baseIndex': index,
                        'sourceIndex': index,
                        '_inserted': value });
                } else {
                    diffActions.push({
                        'action': 'setAttribute',
                        'name': name,
                        'element': base,
                        'baseIndex': index,
                        'sourceIndex': index,
                        '_deleted': val,
                        '_inserted': value });
                }
            }
        }

        // iterate over attributes to remove that the source no longer has
        attributes = base.attributes;
        for (var i = attributes.length; i--; ) {
            name = attributes[i].nodeName;
            if (source.getAttribute(name) === null) {
                diffActions.push({
                    'action': 'removeAttribute',
                    'name': name,
                    'baseIndex': index,
                    'sourceIndex': index,
                    '_deleted': attributes[i].nodeValue });
            }
        }
    }

    // insert, delete, and move child nodes based on a predictable id
    var compare = [];
    if (source.childNodes && base.childNodes) {
        var mapResult = mapElements(base.childNodes),
            nodes = source.childNodes;

        var map = mapResult['map'];
        var indices = mapResult['indices'];

        var moves = generateMoves(map, nodes, indices.slice(0), base, false, index);
        if (moves['diff'].length > 1) {
            var backwardMoves = generateMoves(map, nodes, indices.slice(0), base, true, index);
            if (backwardMoves['diff'].length < moves['diff'].length) {
                moves = backwardMoves;
            }
        }
        diffActions = diffActions.concat(moves['diff']);
        compare = moves['compare'];
    }

    // at this point we should have child nodes of equal length
    if (compare.length > 0) {
        for (var i = 0, len = compare.length; i < len; i++) {
            var sourceChildNode = compare[i][0];
            var baseChildNode = compare[i][1];

            // perform the diff between the given source and base child nodes
            var childDiffs = diff(
                sourceChildNode,
                baseChildNode, index + '>' +
                baseChildNode._i);

            // if there was any difference, concat those to our existing actions
            if (childDiffs.length > 0) {
                diffActions = diffActions.concat(childDiffs);
            }

            // remove temporary data stored on the node
            delete baseChildNode._i;
            delete baseChildNode._id;
        }
    }

    return diffActions;
}

/**
 * Compares two changes and whether they are essentially performing the
 * same change. A change is qualified as the same if it performs the same
 * operation, at the same indices, inserting/deleting/moving or updating data.
 *
 * @param {Change} change1
 * @param {Change} change2
 * @return {boolean}
 */
function isEqualChange(change1, change2) {
    return change1['baseIndex'] === change2['baseIndex'] &&
           change1['sourceIndex'] === change2['sourceIndex'] &&
           change1['action'] === change2['action'] &&
           change1['name'] === change2['name'] &&
           change1['_deleted'] === change2['_deleted'] &&
           change1['_inserted'] === change2['_inserted'] &&
           change1['element'] && change2['element'] &&
           change1['element'].nodeType === change2['element'].nodeType &&
           ((change1['element'].nodeType === 3 && change2['element'].nodeType === 3 &&
            change1['element'].nodeValue === change2['element'].nodeValue) ||
            change1['element'].isEqualNode(change2['element'])) &&
           change1['_textStart'] === change2['_textStart'] &&
           change1['_textEnd'] === change2['_textEnd'];
}

/**
 * Determines if the given changes (child, parent) has a base index that is
 * root of the other one in the dom tree.
 *
 * @param {Change} changeChild
 * @param {Change} changeParent
 * @return {boolean}
 */
function isParentChange(changeChild, changeParent) {
    return (changeChild['baseIndex'].indexOf(changeParent['baseIndex']) === 0 &&
        changeChild['baseIndex'] !== changeParent['baseIndex']);
};

/**
 * Given two ranges, we can determine whether they overlay by calculating
 * whether the total range (max - min) is less than the combined width of
 * each range.
 *
 * @param {Change} range1
 * @param {Change} range2
 * @return {boolean}
 */
function isOverlappingRanges(range1, range2) {
    return (Math.max(range1['_textEnd'], range2['_textEnd']) -
           Math.min(range1['_textStart'], range2['_textStart'])) <
           (range1['_length'] + range2['_length']);
}

/**
 * Creates a patch given a two separate diffs by using a greedy approach
 * where one difference and two same patches will allow a patch to pass. If we
 * encounter a diff where the other doesn't have it at all (identified same node), then
 * that node will also get patched.
 *
 * @param {Array<Change>} theirs
 * @param {Array<Change>} mine
 * @return {Array<Change>}
 */
function patch(theirs, mine) {
    var conflicts = [];
    var changes = [];
    var theirChanges = theirs.slice(0);
    var myChanges = mine.slice(0);
    for (var i = 0, len = theirChanges.length; i<len; i++) {
        var theirItem = theirChanges[i];
        var myItem, m = 0, myLength = myChanges.length;
        for (; m < myLength; m++) {
            myItem = myChanges[m];

            // for each item that matches on ID,
            // we apply the patch which creates a diff
            // a conflict exists when both are applying changes
            var conflicted = false;
            if (theirItem['baseIndex'] === myItem['baseIndex']) {
                if (isEqualChange(theirItem, myItem)) {
                    // one of the changesets is applying something, while
                    // the other is set to equal (no changes)
                    // apply the non-changeset
                    changes.push(myItem);
                    break;
                } else {
                    // if text changes are occuring, we can determine if
                    // there is a conflict, if the _textStart and _textEnd
                    // happen to overlap with the other. any text changes
                    // will always occur on the same base element index,
                    // however text start and text end will be different for
                    // each action. we can check for conflicts when they overlap
                    if ((theirItem['action'] === 'deleteText' || theirItem['action'] === 'insertText') &&
                        (myItem['action'] === 'deleteText' || myItem['action'] === 'insertText')) {
                        if (isOverlappingRanges(theirItem, myItem)) {
                            conflicted = true;
                        }
                    } else {
                        conflicted = true;
                    }
                }
            } else {
                // If myItem['baseIndex'] is root of theirItem['baseIndex'] (or vice-versa)
                // and one of the items is a removal while the other is note, then conflict
                var isTheirsRemove = theirItem['action'] === 'removeChildElement';
                var isMineRemove = myItem['action'] === 'removeChildElement';
                conflicted = ((isParentChange(theirItem, myItem) && isMineRemove && !isTheirsRemove) ||
                    (isParentChange(myItem, theirItem) && !isMineRemove && isTheirsRemove));
            }

            if (conflicted) {
                theirItem['_conflict'] = true;
                theirItem['_owner'] = 'theirs';
                if (!theirItem['_conflictedWith']) {
                    theirItem['_conflictedWith'] = [];
                }
                theirItem['_conflictedWith'].push(myItem);
                myItem['_conflict'] = true;
                myItem['_owner'] = 'mine';
                if (!myItem['_conflictedWith']) {
                    myItem['_conflictedWith'] = [];
                }
                myItem['_conflictedWith'].push(theirItem);
                if (conflicts.indexOf(theirItem) < 0) {
                    conflicts.push(theirItem);
                }
                if (conflicts.indexOf(myItem) < 0) {
                    conflicts.push(myItem);
                }
            }
            myItem = null;
        }

        if (!myItem && !theirItem['_conflict'] && changes.indexOf(theirItem) < 0) {
            changes.push(theirItem);
        }
    }

    if (myChanges.length > 0) {
        for (var i = 0; i < myChanges.length; i++) {
            if (!myChanges[i]['_conflict'] && changes.indexOf(myChanges[i]) < 0) {
                changes.push(myChanges[i]);
            }
        }
    }

    if (conflicts.length > 0) {
        changes = changes.concat(conflicts);
    }

    changes.sort(sortChange);
    return changes;
}

/**
 * Sorts each change set item by their source index in the tree.
 *
 * @param {Change} a
 * @param {Change} b
 * @return {number}
 */
function sortChange(a, b) {
    if (a['sourceIndex'] === b['sourceIndex']) {
        if (a['_textStart'] && b['_textStart']) {
            return (a['_textStart'] > b['_textStart']) ? 1 : -1;
        }
        return 0;
    } else if (!a['sourceIndex'] && b['sourceIndex']) {
        return -1;
    } else if (a['sourceIndex'] && !b['sourceIndex']) {
        return 1;
    }
    var aIndices = a['sourceIndex'].split('>');
    var bIndices = b['sourceIndex'].split('>');
    var equal = true;
    var i = 0;
    while (equal && i < aIndices.length && i < bIndices.length) {
        var aN = parseInt(aIndices[i], 10);
        var bN = parseInt(bIndices[i], 10);
        if (aN === bN) {
            i++;
            continue;
        } else if (isNaN(aN) || isNaN(bN)) {
            return isNaN(aN) ? 1 : -1;
        } else {
            return (aN > bN) ? 1 : -1;
        }
    }

    return 0;
}

/**
 * Locates a given child element from a given parsed index if one exists.
 *
 * @param {Node|Element|DocumentFragment} node
 * @param {null|undefined|string} index
 * @return {?FindNodeAtIndexResult}
 */
var findChildAtIndex = function(node, index) {
    if (!index || !node.childNodes || node.childNodes.length === 0) {
        return null;
    }

    var result = {};
    var indices = index.split('>');
    var found = true;
    var lastParentIndex = '';
    for (var i = 1, len = indices.length; i<len; i++) {
        var nodeIndex = parseInt(indices[i], 10);
        if (node.childNodes && node.childNodes.length > nodeIndex) {
            node = node.childNodes[nodeIndex];
        } else {
            lastParentIndex = indices.slice(0, i-1).join('>');
            found = false;
            break;
        }
    }

    result['lastParent'] = found ? node.parentNode : node;
    result['lastParentIndex'] = found ? index.slice(0, index.lastIndexOf('>')) : lastParentIndex;
    result['node'] = found ? node : null;
    result['found'] = found;
    return result;
};

/**
 * Resolve conflict will apply one of the given patches to the base node.
 *
 * @param {ChangeConflict} conflict
 * @param {Node|Element|DocumentFragment} base
 * @param {string} owner
 * @return {ApplyResult}
 */
function resolve(conflict, base, owner) {
    if (conflict[owner]) {
        return apply(conflict[owner], base, true);
    }

    return null;
};

/**
 * Applies a list of changes to the given base node. Conflicts are treated as
 * inserted tags <theirs> vs <mine>. All removals are performed at the end of
 * all operations, while moves/insertions are performed in order. Updates to
 * text and attributes will be performed inline since this has no affect on the
 * order of the tree. This function will locate all base nodes required for insertions,
 * move and remove operations and applies them at the end of the function.
 * Any nodes that were unable to be found will be considered unapplied.
 *
 * @param {Array<Change>} changes
 * @param {Node|Element|DocumentFragment} base
 * @param {?boolean} force
 * @param {?boolean} showChanges
 * @return {ApplyResult}
 */
function apply(changes, base, force, showChanges) {
    // a patch contains a list of changes to be made to a given element
    var unapplied = [];
    var moves = [];
    var removals = [];
    var conflictChanges = [];
    var textChanges = {};
    for (var c = 0, cLen = changes.length; c < cLen; c++) {
        var change = changes[c];
        var action = change['action'];
        var baseIndex = change['baseIndex'];
        var sourceIndex = change['sourceIndex'];
        var baseReference = change['_baseReference'];
        var sourceReference = change['_sourceReference'];

        if (change['_conflict'] && !force) {
            change['_baseReference'] = findChildAtIndex(base, baseIndex);
            if (sourceIndex && baseIndex !== sourceIndex) {
                change['_sourceReference'] = findChildAtIndex(base, sourceIndex);
            }
            conflictChanges.push(change);
            continue;
        }

        // find the index from the base element
        // this is done using a binary index
        // where 10 is effectively first child element > first child element
        var node = null;
        var findBaseChildResult = baseReference;
        if (findBaseChildResult == null) {
            findBaseChildResult = findChildAtIndex(base, baseIndex);
            if (findBaseChildResult == null) {
                unapplied.push(change);
                continue;
            }
        }

        var node = findBaseChildResult['node'];
        if (!findBaseChildResult['found']) {
            // if we were going to append the element to the base, then
            // do so now, for the given changset to be applied
            if (action === 'insertChildElement') {
                var lastParent = findBaseChildResult['lastParent'];
                var insertion = change['element'];
                if (showChanges) {
                    var insNode = document.createElement('ins');
                    ins.appendChild(insertion);
                    insertion = ins;
                }
                moves.push({
                    'parent': lastParent,
                    'insertion': insertion,
                    'source': null,
                    'change': change,
                    'appendOnly': false
                });
            } else {
                unapplied.push(change);
            }
            continue;
        }

        // if we couldn't find the base index node, apply the insert if it
        // is an appending insert, otherwise, do not apply the change
        if (node === null) {
            continue;
        }

        if (action === 'moveChildElement' || action === 'insertChildElement') {
            // locate the source index from the base node
            var sourceNode = node;
            if (sourceIndex !== baseIndex) {
                var findSourceChildResult = sourceReference;
                if (findSourceChildResult == null) {
                    findSourceChildResult = findChildAtIndex(base, sourceIndex);
                }
                sourceNode = findSourceChildResult !== null ? findSourceChildResult['node'] : null;
            }

            // a move that is prior to a given source element
            if (action === 'moveChildElement') {
                moves.push({
                    'parent': node.parentNode,
                    'insertion': node,
                    'source': sourceNode,
                    'change': change,
                    'appendOnly': false
                });
            } else {
                var insertion = change['element'];
                if (showChanges) {
                    var insNode = document.createElement('ins');
                    insNode.appendChild(insertion);
                    insertion = insNode;
                }
                moves.push({
                    'parent': node.parentNode,
                    'insertion': insertion,
                    'source': sourceNode,
                    'change': change,
                    'appendOnly': false
                });
            }

        } else if (action === 'removeChildElement') {
            if (showChanges) {
                var delNode = document.createElement('del');
                delNode.appendChild(node.cloneNode(true));
                moves.push({
                    'parent': node.parentNode,
                    'insertion': delNode,
                    'source': null,
                    'change': change,
                    'appendOnly': true
                });
            }
            removals.push([node.parentNode, node]);
        } else if (action === 'deleteText' || action === 'insertText') {
            // all text changes need to be grouped into a
            // single action, this helps us apply a single set of
            // operations to the same text node without too much trouble
            var existingOp = textChanges[change['baseIndex']];
            if (!existingOp) {
                existingOp = {
                    'parent': node.parentNode,
                    'source': node,
                    'changes': []
                };
            }

            existingOp['changes'].push(change);
            textChanges[change['baseIndex']] = existingOp;
        } else if (action === 'replaceText') {
            if (!showChanges) {
                node.nodeValue = change['_inserted'];
            } else {
                var deletionNode = document.createElement('del');
                deletionNode.appendChild(document.createTextNode(change['_deleted']));
                var insertionNode = document.createElement('ins');
                insertionNode.appendChild(document.createTextNode(change['_inserted']));
                moves.push({
                    'parent': node.parentNode,
                    'insertion': deletionNode,
                    'source': node,
                    'change': change,
                    'appendOnly': false
                });
                moves.push({
                    'parent': node.parentNode,
                    'insertion': insertionNode,
                    'source': node,
                    'change': change,
                    'appendOnly': false
                });
                node.nodeValue = '';
            }
        } else if (action === 'setAttribute') {
            node.setAttribute(change['name'], change['_inserted']);
        } else if (action === 'removeAttribute') {
            node.removeAttribute(change['name']);
        }
    }

    // perform the moves/insertions last by first sorting the changeset
    moves.sort(function(a, b) {
        return sortChange(a['change'], b['change']);
    });
    for (var i = 0, len = moves.length; i < len; i++) {
        var move = moves[i];
        var parent = move['parent'],
            insertion = move['insertion'],
            source = move['source'],
            change = move['change'],
            appendOnly = move['appendOnly'];

        // if this was an append, then find out the approximate index it should be at
        // based on the relative index of the change itself, if this is still
        // null, then just append the item altogether, typically this will
        // only matter when we are forcing the insertion to happen on conflict resolve
        if (source === null && !appendOnly) {
            var sourceIndex = change['sourceIndex'];
            if (sourceIndex) {
                var lastIndexStr = sourceIndex.substr(sourceIndex.lastIndexOf('>') + 1, sourceIndex.length);
                var childIndex = parseInt(lastIndexStr, 10);
                if (parent.childNodes && parent.childNodes.length > childIndex) {
                    source = parent.childNodes[childIndex];
                }
            }
        }
        parent.insertBefore(insertion, source);
    }

    // execute all removal changes
    for (var i = 0; i < removals.length; i++) {
        var removal = removals[i];
        removal[0].removeChild(removal[1]);
    }

    // execute all text changes
    for (var b in textChanges) {
        var nodeChanges = textChanges[b];
        var node = nodeChanges['source'];
        var value = node.nodeValue;
        var nodeOps = nodeChanges['changes'];
        nodeOps.sort(function (a, b) {
            return a['_textStart'] > b['_textStart'] ? 1 : -1;
        });
        var newStr = '';
        var valueIndex = 0;
        for (var i = 0; i < nodeOps.length; i++) {
            var op = nodeOps[i];
            if (op['action'] === 'insertText') {
                newStr += value.substr(valueIndex, op['_textStart']);
                if (showChanges) {
                    newStr += '<ins>' + escape(op['_inserted']) + '</ins>';
                } else {
                    newStr += op['_inserted'];
                }
                if (valueIndex === op['_textStart']) {
                    newStr += value.substr(valueIndex, op['_textEnd']);
                }
            } else {
                newStr += value.substr(valueIndex, op['_textStart']);
                if (!!showChanges) {
                    newStr += ('<del>' + escape(op['_deleted']) + '</del>');
                }
            }
            valueIndex = op['_textEnd'];
        }
        newStr += value.substr(valueIndex);

        if (!showChanges) {
            node.nodeValue = newStr;
        } else {
            node.innerHTML = newStr;
        }
    }

    // loop through the conflicts and group them by theirs/mine
    var conflicts = [];
    while (conflictChanges.length > 0) {
        var change = conflictChanges.pop();
        var conflict = {
            'mine': [],
            'theirs': []
        };
        conflict[change['_owner']].push(change);
        if (change['_conflictedWith']) {
            var conflictedWithChange = change['_conflictedWith'];
            if (conflictedWithChange) {
                // iterate over the changes that 'change' is conflicted with
                for (var k = 0; k < conflictedWithChange.length; k++) {
                    var conflictedWithItem = conflictedWithChange[k];
                    var i = conflictChanges.indexOf(conflictedWithItem);
                    if (i > -1) {
                        conflictChanges.splice(i, 1);
                        conflict[conflictedWithItem['_owner']].push(conflictedWithItem);
                    }
                    // iterate over the changes that 'conflictedWithItem' is conflicted with
                    if (conflictedWithItem['_conflictedWith']) {
                        for (var s = 0; s < conflictedWithItem['_conflictedWith'].length; s++) {
                            var item = conflictedWithItem['_conflictedWith'][s];
                            var i = conflictChanges.indexOf(item);
                            if (i > -1) {
                                conflictChanges.splice(i, 1);
                                conflict[item['_owner']].push(item);
                            }

                            delete item['_conflictedWith'];
                        }
                    }

                    delete conflictedWithItem['_conflictedWith'];
                }

                // remove temporary reference, since we no longer need it
                delete change['_conflictedWith'];
            }
        }
        conflicts.push(conflict);
    }

    return { 'unapplied': unapplied, 'conflicts': conflicts };
}

export { diff, diffString, patch, apply, resolve, isEqualChange, isParentChange, sortChange }
