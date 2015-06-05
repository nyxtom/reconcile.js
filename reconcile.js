
/**
 * Maps a list of nodes by their id or generated id.
 * @param {NodeList} nodes
 * @return {Object}
 */
export function mapElements(nodes: NodeList) {
    var map = {
        'elements': [],
        'indices': []
    };
    var tags = {};
    var node;

    for (var i = 0, len=nodes.length; i<len; i++) {
        node = nodes[i];
        var id = (node.id) ? node.id : generateId(node, tags);
        map['elements'][id] = node;
        map['indices'][id] = i;
    }

    return map;
}

/**
 * Generates a unique id for a given node by its tag name and existing
 * tags used for disambiguation as well as a given counter per tag use.
 * @param {Node|Element|DocumentFragment} node
 * @param {Object} tags
 * @return {string}
 */
export function generateId(node: Node|Element|DocumentFragment, tags: Object) {
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
 * Merges two given nodes by checking their content
 * node type, attribute differences and finally their
 * child nodes through various diff operations. This
 * will merge and return the diff as a list.
 * @param {Node|Element|DocumentFragment} source
 * @param {Node|Element|DocumentFragment} base
 * @return {Array}
 */
export function merge(source: Node|Element|DocumentFragment, base: Node|Element|DocumentFragment) {
    var diffActions = [];
    // if the source and base is either a text node or a comment node,
    // then we can simply say the difference is their text content
    if ((source.nodeType === 3 && base.nodeType === 3) ||
        (source.nodeType === 8 && base.nodeType === 8)) {
        if (base.nodeValue !== source.nodeValue) {
            diffActions.push({ 'action': 'replaceText',
                               'node': base,
                               '_deleted': base.nodeValue,
                               '_inserted': source.newValue});
           base.nodeValue = source.nodeValue;
        }

        return diffActions;
    }

    // look for differences between the nodes by their attributes
    if (source.attributes && base.attributes) {
        var attributes = source.attributes,
            value,
            name;

        // iterate over the source attributes that we want to copy over to the new base node
        for (var i = 0, len=attributes.length; i<len; i++) {
            value = attributes[i].nodeValue;
            name = attributes[i].nodeName;

            var val = base.getAttribute(name);
            if (val !== value) {
                if (val === null) {
                    diffActions.push({ 'action': 'setAttribute',
                                       'node': base,
                                       'name': name,
                                       '_inserted': value});
                } else {
                    diffActions.push({ 'action': 'setAttribute',
                                       'node': base,
                                       'name': name,
                                       '_deleted': val,
                                       '_inserted': value});
                }
                base.setAttribute(name, value);
            }
        }

        // iterate over attributes to remove that the source no longer has
        attributes = base.attributes;
        for (var i = 0, len=attributes.length; i<len; i++) {
            name = attributes[i].nodeName;
            if (source.getAttribute(name) === null) {
                diffActions.push({ 'action': 'removeAttribute',
                                   'node': base,
                                   'name': name,
                                   '_deleted': base.getAttribute(name)});
                base.removeAttribute(name);
            }
        }
    }

    // return if the nodes are equal after attribute changes
    if (source.isEqualNode(base)) {
        return diffActions;
    }

    // insert, delete, and move child nodes based on a predictable id
    if (source.childNodes && base.childNodes) {
        var map = mapElements(base.childNodes),
            tags = {},
            nodes = source.childNodes;

        // loop through each source node and get the relevant base node
        var elements = map['elements'];
        var indices = map['indices'];
        for (var i = 0, len=nodes.length; i<len; i++) {
            var node = nodes[i],
                bound = base.childNodes[i],
                id = (node.id) ? node.id : generateId(node, tags);

            // check if the node has an id
            // if it exists in the base map, then move that node to the correct
            // position, this will usually be the same node, which means no dom move
            // is necessary, otherwise clone the node from the source (new inserts)
            var existing = elements[id];
            if (existing) {
                if (existing !== bound) {
                    diffActions.push({ 'action': 'moveChildElement',
                                       'node': base,
                                       'element': existing});
                    base.insertBefore(existing, bound);
                } else {
                    if (existing.isEqualNode(node)) {
                        diffActions.push({ 'action': 'equal',
                                           'node': base,
                                           'element': existing});
                    }
                }
            } else {
                var inserted = node.cloneNode(true);
                diffActions.push({ 'action': 'insertChildElement',
                                   'node': base,
                                   'element': inserted});
                base.insertBefore(inserted, bound);
            }
        }

        // Remove any tail nodes in the base
        while (base.childNodes.length > source.childNodes.length) {
            var remove = base.childNodes[base.childNodes.length-1];
            diffActions.push({ 'action': 'removeChildElement',
                               'node': base,
                               'element': remove});
            base.removeChild(remove);
        }
    }

    // iterate through child nodes to determine whether any further changes need to be made
    if (source.isEqualNode(base)) {
        return diffActions;
    }

    // at this point we should have child nodes of equal length
    if (source.childNodes.length > 0) {
        for (var i = 0, len=source.childNodes.length; i<len; i++) {
            var childDiffs = merge(source.childNodes[i], base.childNodes[i]);
            if (childDiffs.length > 0) {
                diffActions = diffActions.concat(childDiffs);
            }
        }
    }

    return diffActions;
}
