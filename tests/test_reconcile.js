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
        expect(result.length).toEqual(2);
        expect(result[0]['action']).toEqual('deleteText');
        expect(result[0]['_deleted']).toEqual('there');
        expect(result[1]['action']).toEqual('insertText');
        expect(result[1]['_inserted']).toEqual('world');
    });

    it('should return a text diff of full deletions/insertions', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello to the world';
        var source = document.createElement('div');
        source.innerHTML = 'hello universe';
        var result = reconcile.diff(source, base);
        expect(!source.isEqualNode(base)).toBeTruthy();
        expect(result.length).toEqual(2);
        expect(result[0]['action']).toEqual('deleteText');
        expect(result[0]['_deleted']).toEqual('to the world');
        expect(result[1]['action']).toEqual('insertText');
        expect(result[1]['_inserted']).toEqual('universe');
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
        expect(result.conflicts.length).toEqual(1);
        expect(base.innerHTML).toEqual('<b>more content</b> hello <strong>else</strong>');
        result = reconcile.resolve(result.conflicts[0], base, 'theirs');
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(0);
        expect(base.innerHTML).toEqual('<b>more content</b> hello <i>austin</i><strong>else</strong>');
    });

    it('should be able to resolve three way conflicts with parent removal - mine', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello <b>world</b>';
        var source = document.createElement('div');
        source.innerHTML = 'hello <b>bleh</b>';
        var theirs = document.createElement('div');
        theirs.innerHTML = 'hello ';
        var theirMerge = reconcile.diff(theirs, base);
        var myMerge = reconcile.diff(source, base);
        var changes = reconcile.patch(theirMerge, myMerge);
        var result = reconcile.apply(changes, base);
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(1);
        expect(base.innerHTML).toEqual('hello <b>world</b>');
        result = reconcile.resolve(result.conflicts[0], base, 'mine');
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(0);
        expect(base.innerHTML).toEqual('hello <b>bleh</b>');
    });

    it('should be able to resolve three way conflicts with parent removal - theirs', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello <b>world</b>';
        var source = document.createElement('div');
        source.innerHTML = 'hello <b>bleh</b>';
        var theirs = document.createElement('div');
        theirs.innerHTML = 'hello ';
        var theirMerge = reconcile.diff(theirs, base);
        var myMerge = reconcile.diff(source, base);
        var changes = reconcile.patch(theirMerge, myMerge);
        var result = reconcile.apply(changes, base);
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(1);
        expect(base.innerHTML).toEqual('hello <b>world</b>');
        result = reconcile.resolve(result.conflicts[0], base, 'theirs');
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(0);
        expect(base.innerHTML).toEqual('hello ');
    });

    it('should be able to resolve three way conflicts with simple text changes - theirs', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello <b>world</b>';
        var source = document.createElement('div');
        source.innerHTML = 'hello <b>bleh</b>';
        var theirs = document.createElement('div');
        theirs.innerHTML = 'hello <b>content</b>';
        var theirMerge = reconcile.diff(theirs, base);
        var myMerge = reconcile.diff(source, base);
        var changes = reconcile.patch(theirMerge, myMerge);
        var result = reconcile.apply(changes, base);
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(1);
        expect(base.innerHTML).toEqual('hello <b></b>');
        result = reconcile.resolve(result.conflicts[0], base, 'theirs');
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(0);
        expect(base.innerHTML).toEqual('hello <b>content</b>');
    });

    it('should be able to resolve three way conflicts with simple text changes - mine', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello <b>world</b>';
        var source = document.createElement('div');
        source.innerHTML = 'hello <b>bleh</b>';
        var theirs = document.createElement('div');
        theirs.innerHTML = 'hello <b>content</b>';
        var theirMerge = reconcile.diff(theirs, base);
        var myMerge = reconcile.diff(source, base);
        var changes = reconcile.patch(theirMerge, myMerge);
        var result = reconcile.apply(changes, base);
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(1);
        expect(base.innerHTML).toEqual('hello <b></b>');
        result = reconcile.resolve(result.conflicts[0], base, 'mine');
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(0);
        expect(base.innerHTML).toEqual('hello <b>bleh</b>');
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

    it('should be able to resolve simple lists', function() {
        var base = document.createElement('div');
        base.innerHTML = 'one<b>two</b>';
        var source = document.createElement('div');
        source.innerHTML = '<b>three</b>one<b>two</b>';
        var theirs = document.createElement('div');
        theirs.innerHTML = 'one<b>four</b>';
        var theirMerge = reconcile.diff(theirs, base.cloneNode(true));
        var myMerge = reconcile.diff(source, base.cloneNode(true));
        var changes = reconcile.patch(theirMerge, myMerge);
        var result = reconcile.apply(changes, base);
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(0);
        expect(base.innerHTML).toEqual('<b>three</b>one<b>four</b>');
    });

    it('should be able to detect conflicts and resolve to mine on simple text nodes', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello world';
        var source = document.createElement('div');
        source.innerHTML = 'hello universe';
        var theirs = document.createElement('div');
        theirs.innerHTML = 'hello evernote';
        var theirMerge = reconcile.diff(theirs, base);
        var myMerge = reconcile.diff(source, base);
        var changes = reconcile.patch(theirMerge, myMerge);
        var result = reconcile.apply(changes, base);
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(1);
        expect(base.innerHTML).toEqual('hello ');
        result = reconcile.resolve(result.conflicts[0], base, 'mine');
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(0);
        expect(base.innerHTML).toEqual('hello universe');
    });

    it('should be able to detect conflicts and resolve to theirs on simple text nodes', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello world';
        var source = document.createElement('div');
        source.innerHTML = 'hello universe';
        var theirs = document.createElement('div');
        theirs.innerHTML = 'hello evernote';
        var theirMerge = reconcile.diff(theirs, base);
        var myMerge = reconcile.diff(source, base);
        var changes = reconcile.patch(theirMerge, myMerge);
        var result = reconcile.apply(changes, base);
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(1);
        expect(base.innerHTML).toEqual('hello ');
        result = reconcile.resolve(result.conflicts[0], base, 'theirs');
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(0);
        expect(base.innerHTML).toEqual('hello evernote');
    });

    it('should be able merge move and replace text', function() {
        var base = document.createElement('div');
        base.innerHTML = 'hello <b>austin</b>';
        var source = document.createElement('div');
        source.innerHTML = '<i>welcome:</i> hello <b>austin</b>';
        var theirs = document.createElement('div');
        theirs.innerHTML = 'hello <b>world</b>';
        var theirMerge = reconcile.diff(theirs, base);
        var myMerge = reconcile.diff(source, base);
        var changes = reconcile.patch(theirMerge, myMerge);
        var result = reconcile.apply(changes, base);
        expect(result.unapplied).toEqual([]);
        expect(result.conflicts.length).toEqual(0);
        expect(base.innerHTML).toEqual('<i>welcome:</i> hello <b>world</b>');
    });

});
