(function (global, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        var mod = {
            exports: {}
        };
        factory(mod.exports);
        global.reconcile = mod.exports;
    }
})(this, function (exports) {
    /**
     * reconcile.js
     * An implementation of the reconciliation algorithm presented by Facebook
     * react.js (https://facebook.github.io/react/docs/reconciliation.html). This
     * handles the diff between two nodes using the above algorithm. Additionally,
     * this library will generate the diff actions, and allow you to perform
     * a patch and applied changeset using a three-way merge option.
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
     *    name: (null|undefined|string|number)
     * }}
     */
    'use strict';

    exports.mapElements = mapElements;
    exports.generateId = generateId;
    exports.diff = diff;
    exports.isEqualChange = isEqualChange;
    exports.patch = patch;
    exports.sortChangeset = sortChangeset;
    exports.apply = apply;

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

    var ChangeSet = function ChangeSet() {
        _classCallCheck(this, ChangeSet);
    };

    exports.ChangeSet = ChangeSet;

    /**
     * Maps a list of nodes by their id or generated id.
     * @param {NodeList} nodes
     * @return {Object}
     */

    function mapElements(nodes) {
        var map = {};
        var tags = {};
        var node;

        var indices = [];
        for (var i = 0, len = nodes.length; i < len; i++) {
            node = nodes[i];
            var id = node.id ? node.id : generateId(node, tags);
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
        var tag = node.tagName ? node.tagName : 'x' + node.nodeType;

        // set the counter to zero
        if (!tags[tag]) {
            tags[tag] = 0;
        }

        // increment the counter for that tag
        tags[tag]++;

        return tag + tags[tag];
    }

    /**
     * Merges two given nodes by checking their content
     * node type, attribute differences and finally their
     * child nodes through various diff operations. This
     * will merge and return the diff as a list.
     * @param {Node|Element|DocumentFragment} source
     * @param {Node|Element|DocumentFragment} base
     * @param {null|undefined|string} index
     * @return {Array<ChangeSet>}
     */

    function diff(source, base, index) {
        var diffActions = [];
        if (source.isEqualNode(base)) {
            return diffActions;
        }
        if (typeof index === 'undefined') {
            index = '0'; // 0 for root node
        }
        // if the source and base is either a text node or a comment node,
        // then we can simply say the difference is their text content
        if (source.nodeType === 3 && base.nodeType === 3) {
            if (base.nodeValue !== source.nodeValue) {
                diffActions.push({
                    'action': 'replaceText',
                    'element': base,
                    'baseIndex': index,
                    'sourceIndex': index,
                    '_deleted': base.nodeValue,
                    '_inserted': source.nodeValue });
            }

            return diffActions;
        }

        // look for differences between the nodes by their attributes
        if (source.attributes && base.attributes) {
            var attributes = source.attributes,
                value,
                name;

            // iterate over the source attributes that we want to copy over to the new base node
            for (var i = 0, len = attributes.length; i < len; i++) {
                value = attributes[i].nodeValue;
                name = attributes[i].nodeName;

                var val = base.getAttribute(name);
                if (val !== value) {
                    if (val === null) {
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
            for (var i = 0, len = attributes.length; i < len; i++) {
                name = attributes[i].nodeName;
                if (source.getAttribute(name) === null) {
                    diffActions.push({
                        'action': 'removeAttribute',
                        'name': name,
                        'baseIndex': index,
                        'sourceIndex': index,
                        '_deleted': base.getAttribute(name) });
                }
            }
        }

        // return if the nodes are equal after attribute changes
        if (source.isEqualNode(base)) {
            return diffActions;
        }

        // insert, delete, and move child nodes based on a predictable id
        var compare = [];
        if (source.childNodes && base.childNodes) {
            var mapResult = mapElements(base.childNodes),
                tags = {},
                nodes = source.childNodes;

            var map = mapResult['map'];
            var indices = mapResult['indices'];

            // loop through each source node and get the relevant base node
            var moves = [];
            var operateMap = {};
            for (var i = 0, len = nodes.length; i < len; i++) {
                var node = nodes[i],
                    bound = base.childNodes[indices[i]],
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
                        diffActions.push({
                            'action': 'moveChildElement',
                            'element': existing,
                            'baseIndex': index + '>' + existing._i,
                            'sourceIndex': index + '>' + i });

                        // move the index so we can retrieve the next appropriate node
                        indices.splice(i, 0, indices.splice(existing._i, 1)[0]);
                    }
                    if (!node.isEqualNode(existing)) {
                        compare.push([node, existing]);
                    }
                } else {
                    var inserted = node.cloneNode(true);
                    diffActions.push({
                        'action': 'insertChildElement',
                        'element': inserted,
                        'baseIndex': index + '>' + i,
                        'sourceIndex': index + '>' + i });
                }
                operateMap[id] = true;
            }

            // Remove any tail nodes in the base
            for (var i = 0, len = base.childNodes.length; i < len; i++) {
                var remove = base.childNodes[i];
                var removeId = remove._id;
                if (!operateMap[removeId]) {
                    diffActions.push({
                        'action': 'removeChildElement',
                        'element': remove,
                        'baseIndex': index + '>' + remove._i,
                        'sourceIndex': null });
                }
            }
        }

        // iterate through child nodes to determine whether any further changes need to be made
        if (source.isEqualNode(base)) {
            return diffActions;
        }

        // at this point we should have child nodes of equal length
        if (compare.length > 0) {
            for (var i = 0, len = compare.length; i < len; i++) {
                var sourceChildNode = compare[i][0];
                var baseChildNode = compare[i][1];

                // perform the diff between the given source and base child nodes
                var childDiffs = diff(sourceChildNode, baseChildNode, index + '>' + baseChildNode._i);

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
     * @param {ChangeSet} change1
     * @param {ChangeSet} change2
     * @return {boolean}
     */

    function isEqualChange(change1, change2) {
        return change1['baseIndex'] === change2['baseIndex'] && change1['sourceIndex'] === change2['sourceIndex'] && change1['action'] === change2['action'] && change1['name'] === change2['name'] && change1['_deleted'] === change2['_deleted'] && change1['_inserted'] === change2['_inserted'] && change1['element'].isEqualNode(change2['element']);
    }

    /**
     * Creates a patch given a two separate diffs by using a greedy approach
     * where one difference and two same patches will allow a patch to pass. If we
     * encounter a diff where the other doesn't have it at all (identified same node), then
     * that node will also get patched.
     *
     * @param {Array<ChangeSet>} theirs
     * @param {Array<ChangeSet>} mine
     * @return {Array<ChangeSet>}
     */

    function patch(theirs, mine) {
        var conflicts = [];
        var changes = [];
        var theirChanges = theirs.slice(0);
        var myChanges = mine.slice(0);
        for (var i = 0, len = theirChanges.length; i < len; i++) {
            var theirItem = theirChanges[i];
            var myItem,
                m = 0,
                myLength = myChanges.length;
            for (; m < myLength; m++) {
                myItem = myChanges[m];

                // for each item that matches on ID,
                // we apply the patch which creates a diff
                // a conflict exists when both are applying changes
                if (theirItem['baseIndex'] === myItem['baseIndex']) {
                    if (isEqualChange(theirItem, myItem)) {
                        // one of the changesets is applying something, while
                        // the other is set to equal (no changes)
                        // apply the non-changeset
                        changes.push(myItem);
                    } else {
                        // we have a conflict
                        theirItem['_conflict'] = true;
                        theirItem['_owner'] = 'theirs';
                        myItem['_conflict'] = true;
                        myItem['_owner'] = 'mine';
                        conflicts.push(theirItem);
                        conflicts.push(myItem);
                    }
                    break;
                }
                myItem = null;
            }

            if (!myItem) {
                changes.push(theirItem);
            } else {
                myChanges.splice(m, 1);
            }
        }

        if (myChanges.length > 0) {
            changes = changes.concat(myChanges);
        }

        if (conflicts.length > 0) {
            changes = changes.concat(conflicts);
        }

        changes.sort(sortChangeset);
        return changes;
    }

    /**
     * Sorts each change set item by their source index in the tree.
     *
     * @param {ChangeSet} a
     * @param {ChangeSet} b
     */

    function sortChangeset(a, b) {
        if (a['sourceIndex'] === b['sourceIndex']) {
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
                return aN > bN ? 1 : -1;
            }
        }

        return 0;
    }

    /**
     * Applies a list of changes to the given base node. Conflicts are treated as
     * inserted tags <theirs> vs <mine>. All removals are performed at the end of
     * all operations, while moves/insertions are performed in order. Updates to
     * text and attributes will be performed inline since this has no affect on the
     * order of the tree. This function will locate all base nodes required for insertions,
     * move and remove operations and applies them at the end of the function.
     * Any nodes that were unable to be found will be considered unapplied.
     *
     * @param {Array<ChangeSet>} changes
     * @param {Node|Element|DocumentFragment} base
     * @return {{ unapplied: Array<ChangeSet>, conflicts: Array<{{ mine: ChangeSet, theirs: ChangeSet }}> }}
     */

    function apply(changes, base) {
        // a patch contains a list of changes to be made to a given element
        var unapplied = [];
        var moves = [];
        var removals = [];
        var conflictNodes = [];
        for (var c = 0, cLen = changes.length; c < cLen; c++) {
            var change = changes[c];
            var action = change['action'];
            var baseIndex = change['baseIndex'];
            var sourceIndex = change['sourceIndex'];
            // find the index from the base element
            // this is done using a binary index
            // where 10 is effectively first child element > first child element
            var node = base;
            var baseItemIndices = baseIndex.split('>');
            for (var i = 1, len = baseItemIndices.length; i < len; i++) {
                var nodeIndex = parseInt(baseItemIndices[i], 10);
                if (node.childNodes && node.childNodes.length > nodeIndex) {
                    node = node.childNodes[nodeIndex];
                } else {
                    // if we were going to append the element to the base, then
                    // do so now, for the given changset to be applied
                    if (action === 'insertChildElement') {
                        moves.push([node, change['element'], null, change]);
                    } else {
                        unapplied.push(change);
                    }
                    node = null;
                    break;
                }
            }

            // if we couldn't find the base index node, apply the insert if it
            // is an appending insert, otherwise, do not apply the change
            if (node === null) {
                continue;
            }

            if (action === 'moveChildElement' || action === 'insertChildElement') {
                // locate the source index from the base node
                var sourceNode = base;
                var sourceItemIndices = sourceIndex.split('>');
                for (var i = 1, len = sourceItemIndices.length; i < len; i++) {
                    var nodeIndex = parseInt(sourceItemIndices[i], 10);
                    if (sourceNode.childNodes && sourceNode.childNodes.length > nodeIndex) {
                        sourceNode = sourceNode.childNodes[nodeIndex];
                    } else {
                        sourceNode = null;
                        break;
                    }
                }
                // a move that is prior to a given source element
                if (action === 'moveChildElement') {
                    moves.push([node.parentNode, node, sourceNode, change]);
                } else {
                    if (sourceNode === null) {
                        moves.push([node.parentNode, change['element'], null, change]);
                    } else {
                        moves.push([node.parentNode, change['element'], sourceNode, change]);
                    }
                }
            } else if (action === 'removeChildElement') {
                removals.push([node.parentNode, node]);
            } else if (!change['conflict']) {
                if (action === 'replaceText') {
                    node.nodeValue = change['_inserted'];
                } else if (action === 'setAttribute') {
                    node.setAttribute(change['name'], change['_inserted']);
                } else if (action === 'removeAttribute') {
                    node.removeAttribute(change['name']);
                }
            } else {
                node['_conflict_' + change['owner']] = change['_inserted'];
                conflictNodes.push(node);
            }
        }

        // perform the moves/insertions last by first sorting the changeset
        moves.sort(function (a, b) {
            return sortChangeset(a[3], b[3]);
        });
        for (var i = 0, len = moves.length; i < len; i++) {
            var move = moves[i];
            var parent = move[0],
                insertion = move[1],
                source = move[2],
                change = move[3];

            if (change['_conflict']) {
                var conflictNode = document.createElement(change['_owner']);
                conflictNode.appendChild(insertion);
                conflictNodes.push(conflictNode);
                insertion = conflictNode;
            }

            parent.insertBefore(insertion, source);
        }

        // execute all removal changes
        for (var i = 0; i < removals.length; i++) {
            var removal = removals[i];
            removal[0].removeChild(removal[1]);
        }

        return { 'unapplied': unapplied, 'conflicts': conflictNodes };
    }
});

