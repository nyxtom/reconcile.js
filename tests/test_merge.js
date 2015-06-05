import * as reconcile from '../reconcile.js';

describe('Merge Nodes', function() {

    it('should return no diff for equal nodes', function() {
        var nodeA = document.createElement('div');
        nodeA.appendChild(document.createTextNode('hello world'));
        var nodeB = document.createElement('div');
        nodeB.appendChild(document.createTextNode('hello world'));
        var result = reconcile.merge(nodeA, nodeB);
        expect(result).toEqual([]);
        expect(nodeA.isEqualNode(nodeB));
    });

    it('should return a text diff', function() {
        var nodeA = document.createElement('div');
        nodeA.appendChild(document.createTextNode('hello world'));
        var nodeB = document.createElement('div');
        nodeB.appendChild(document.createTextNode('hello there'));
        var result = reconcile.merge(nodeA, nodeB);
        expect(nodeA.isEqualNode(nodeB));
        expect(result.length).toEqual(1);
        expect(result[0]['action']).toEqual('replaceText');
        expect(result[0]['_deleted']).toEqual('hello there');
    });

    it('should return a new child diff', function() {
        var nodeA = document.createElement('div');
        nodeA.appendChild(document.createTextNode('hello '));
        nodeA.appendChild(document.createElement('i'));
        nodeA.lastChild.appendChild(document.createTextNode('there'));
        var nodeB = document.createElement('div');
        nodeB.appendChild(document.createTextNode('hello '));
        nodeB.appendChild(document.createElement('b'));
        nodeB.lastChild.appendChild(document.createTextNode('there'));
        var result = reconcile.merge(nodeA, nodeB);
        expect(nodeA.isEqualNode(nodeB));
        expect(result.length).toEqual(2);
        expect(result[0]['action']).toEqual('insertChildElement');
        expect(result[0]['_inserted']['tagName']).toEqual('I');
        expect(result[1]['action']).toEqual('removeChildElement');
        expect(result[1]['_deleted']['tagName']).toEqual('B');
    });

});
