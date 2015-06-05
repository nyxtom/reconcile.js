import * as reconcile from '../reconcile.js';

describe('Merge Nodes', function() {

    it('should return no diff for equal nodes', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello world';
        var source = document.createElement('div');
        source.innerHTML = 'hello world';
        var result = reconcile.merge(source, base);
        expect(result).toEqual([]);
        expect(source.isEqualNode(base));
    });

    it('should return a text diff', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello there';
        var source = document.createElement('div');
        source.innerHTML = 'hello world';
        var result = reconcile.merge(source, base);
        expect(source.isEqualNode(base));
        expect(result.length).toEqual(1);
        expect(result[0]['action']).toEqual('replaceText');
        expect(result[0]['_deleted']).toEqual('hello there');
    });

    it('should return a new child diff', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello <b>there</b>';
        var source = document.createElement('div');
        source.innerHTML = 'hello <i>there<i>';
        var result = reconcile.merge(source, base);
        expect(source.isEqualNode(base));
        expect(result.length).toEqual(3);
        expect(result[0]['action']).toEqual('equal');
        expect(result[0]['element'].nodeValue).toEqual('hello ');
        expect(result[1]['action']).toEqual('insertChildElement');
        expect(result[1]['element']['tagName']).toEqual('I');
        expect(result[2]['action']).toEqual('removeChildElement');
        expect(result[2]['element']['tagName']).toEqual('B');
    });

    it('should be able to resolve three way merges', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello <b>world</b>';
        var source = document.createElement('div');
        source.innerHTML = 'hello <b>world</b>. And something <strong>else</strong>';
        var theirs = document.createElement('div');
        theirs.innerHTML = 'hello <i>austin</i>';
        var theirMerge = reconcile.merge(theirs, base.cloneNode(true));
        var myMerge = reconcile.merge(source, base.cloneNode(true));
    });

});
