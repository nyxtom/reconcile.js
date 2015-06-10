import * as reconcile from '../lib/reconcile.js';

describe('Merge Nodes', function() {

    it('should return no diff for equal nodes', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello world';
        var source = document.createElement('div');
        source.innerHTML = 'hello world';
        var result = reconcile.diff(source, base);
        expect(result).toEqual([]);
        expect(source.isEqualNode(base)).toBeTruthy();
    });

    it('should return a text diff', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello there';
        var source = document.createElement('div');
        source.innerHTML = 'hello world';
        var result = reconcile.diff(source, base);
        expect(!source.isEqualNode(base)).toBeTruthy();
        expect(result.length).toEqual(1);
        expect(result[0]['action']).toEqual('replaceText');
        expect(result[0]['_deleted']).toEqual('hello there');
    });

    it('should return a new child diff', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello <b>there</b>';
        var source = document.createElement('div');
        source.innerHTML = 'hello <i>there<i>';
        var result = reconcile.diff(source, base);
        expect(!source.isEqualNode(base)).toBeTruthy();
        expect(result.length).toEqual(2);
        expect(result[0]['action']).toEqual('insertChildElement');
        expect(result[0]['element']['tagName']).toEqual('I');
        expect(result[1]['action']).toEqual('removeChildElement');
        expect(result[1]['element']['tagName']).toEqual('B');
    });

    it('should be able to resolve three way merges', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello <b>world</b>';
        var source = document.createElement('div');
        source.innerHTML = 'hello <b>world</b>. And something <strong>else</strong>';
        var theirs = document.createElement('div');
        theirs.innerHTML = '<b>more content</b> hello <i>austin</i>';
        var theirMerge = reconcile.diff(theirs, base);
        var myMerge = reconcile.diff(source, base);
        var changes = reconcile.patch(theirMerge, myMerge);
        var result = reconcile.apply(changes, base);
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(2);
        expect(base.innerHTML).toEqual('<b>more content</b> hello <theirs><i>austin</i></theirs><mine>. And something </mine><strong>else</strong>');
    });

    it('should be able to resolve more complex three way merges', function() {
        var base = document.createElement('div');
        base.innerHTML = '<ul><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><ul><li>asdfasdf</li><li>asdf</li></ul></ul></ul></ul></ul><div><br /></div><div><br /></div><div><br /></div><div><br /></div><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><li>asdfasdf</li><li>asdf</li></ul></ul></ul><div><br /></div><div><br /></div><div>fasdjflksadf</div><div><br /></div><ul><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><li>asdfasdf</li><li>asdf</li></ul></ul></ul></ul><div><br /></div><div><br /></div><ul><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><li>asdfasdf</li><li>asdf</li></ul></ul></ul></ul>';
        var source = document.createElement('div');
        source.innerHTML = '<ul><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><ul><li><b>asdfasdf</b></li><li><b>inserted here</b></li><li><b>asdf</b></li></ul></ul></ul></ul></ul><div><br /></div><div><br /></div><div>and some more content <i>here!!!</i></div><div><br /></div><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><li>asdfasdf</li><li>asdf</li></ul></ul></ul><div><br /></div><div><br /></div><div>fasdjflksadf</div><div><br /></div><ul><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><li>asdfasdf</li><li>asdf</li></ul></ul></ul></ul><div><br /></div><div><br /></div><ul><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><li>asdfasdf</li><li>asdf</li></ul></ul></ul></ul>';
        var theirs = document.createElement('div');
        theirs.innerHTML = '<ul><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><ul><li>asdfasdf</li><li>asdf</li></ul></ul></ul></ul></ul><div><br /></div><div><br /></div><div><br /></div><div><br /></div><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><li>asdfasdf</li><li>asdf</li></ul></ul></ul><div><br /></div><div><br /></div><div>fasdjflksadf</div><div>and <b>some more content here!!!</b><i>sadkfjaslkdjflsa</i></div><div><br /></div><ul><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><li><b>asdfasdf</b></li><li>asdf</li></ul></ul></ul></ul><div><br /></div><div><br /></div><ul><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><li>asdfasdf</li><li>asdf</li></ul></ul></ul></ul>';
        var theirMerge = reconcile.diff(theirs, base);
        var myMerge = reconcile.diff(source, base);
        var changes = reconcile.patch(theirMerge, myMerge);
        var result = reconcile.apply(changes, base);
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(0);
        expect(base.innerHTML).toEqual('<ul><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><ul><li><b>asdfasdf</b></li><li><b>inserted here</b></li><li><b>asdf</b></li></ul></ul></ul></ul></ul><div><br></div><div><br></div><div>and some more content <i>here!!!</i></div><div><br></div><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><li>asdfasdf</li><li>asdf</li></ul></ul></ul><div><br></div><div><br></div><div>fasdjflksadf</div><div>and <b>some more content here!!!</b><i>sadkfjaslkdjflsa</i></div><div><br></div><ul><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><li><b>asdfasdf</b></li><li>asdf</li></ul></ul></ul></ul><div><br></div><div><br></div><ul><ul><li>tester</li><li>asdf</li><ul><li>asdf</li><ul><li>asdfasdf</li><li>asdf</li></ul></ul></ul></ul>');
    });

    it('should be able to perform move and replace text operationally', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello <b>world</b>';
        var source = document.createElement('div');
        source.innerHTML = 'hello <b>universe</b>';
        var theirs = document.createElement('div');
        theirs.innerHTML = '<b>world</b> hello <i>austin</i>';
        var theirMerge = reconcile.diff(theirs, base);
        var myMerge = reconcile.diff(source, base);
        var changes = reconcile.patch(theirMerge, myMerge);
        var result = reconcile.apply(changes, base);
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(0);
        expect(base.innerHTML).toEqual('<b>universe</b> hello <i>austin</i>');
    });

});
