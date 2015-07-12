# Reconcile.js  [![Build Status](https://secure.travis-ci.org/nyxtom/reconcile.js.png?branch=master)](https://travis-ci.org/nyxtom/reconcile.js)
Reconcile is a simple diff, patch and merge implementation inspired by Facebook's React.js
approach to virtualizing the dom and performing updates through reconciliation.
The goal of this library is to provide a very simple utility for performing diffs,
patches and merges of html documents. The strategy is done such that you should be able
to perform two-way or three-way merges depending on the context. Refer to
Facebook React -
[Reconciliation](https://facebook.github.io/react/docs/reconciliation.html)
for a more in depth look at how this algorithm is meant to function. This implementation will
also perform whitespace/word based text differences to allow changes to be made to the same text node
without any conflicts being produced (or atleast minimize conflicts).

### Features

- non-destructive diff between two HTML DOM Element Trees
- diff operations supported:
  - **removeAttribute**, **setAttribute**
  - **setStyleValue**, **removeStyleValue**
  - **insertText**, **deleteText**
  - **moveChildElement**, **insertChildElement**, **removeChildElement**
- three-way merging between two diff changesets with automatic conflict resolution
- forward/reverse diff checks on move/insert/remove to generate reduced changeset
- Removing a parent element and a change to a subtree of a parent generates conflicts
- Manual conflict resolution with theirs/mine ala **reconcile.resolve**
- Option to show changes inline with **&lt;ins&gt;** and **&lt;del&gt;**
- text diff implementation based on jsdiff (from John Resig) which has been extended to support
returning changesets and continous deletions/insertion strings.
- style value changes for style attribute specific updates. This supports order agnostic
changes to the style string (stripping away comments and handles inline content values).

### Installation

To install from npm, simply use the following command. Otherwise you can
just clone the repo and use **reconcile.umd.js** or
**reconcile.umd.min.js**. This library uses the [UMD (Universal Module
Definition)](https://github.com/umdjs/umd) pattern for JavaScript modules.

```
npm install reconcile.js
```

### Diff Nodes
Based on Facebook's Reconciliation algorithm, the approach for a O(n) diff and merge  
algorithm is much preferred over traditional tree diff algorithms. Reconciliation will
treat each node as unique in the context of its type, attributes, tags and content. When
performing a diff and patch, the implementation will generate an array of actions that
were made when transforming a given target content to the source element. Additionally,
to avoid having to iterate over the elements a second time, we transform the target node
to speed up the process while we are generating the diff itself. To generate a diff of
the changes from source to target, use the following code:

```
var changes = reconcile.diff(source, target);
```

This should give you a list of changes which you can then apply to the target with:

```
reconcile.apply(changes, target);
```

**diff** will use a forward and backward run on the move/insertion/remove operations
in order to generate the smallest possible changeset. This should help reduce the possible
conflicts that may occur as you encounter three-way merges for multiple patches below.

### Patch Nodes
If you wish to apply additional changes on top of an existing changeset. You can do
this easily by creating a patch from your diff arguments. You should be careful to
apply each changeset in the order you received your diffs. Each patch will perform
a three-way merge changeset which can then be applied afterwords.

```
var theirs = reconcile.diff(theirSource, base);
var mine = reconcile.diff(mySource, base);
var changes = reconcile.patch(theirs, mine);
var result = reconcile.apply(changes, base);

// if you encounter a conflict, you can resolve it below
for (let conflict of conflicts) {
    reconcile.resolve(conflict, base, 'mine');
}

```

### LICENCE

The MIT License (MIT)

Copyright (c) 2015 Thomas Holloway

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Facebook React LICENCE

BSD License

For React software

Copyright (c) 2013-2015, Facebook, Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 * Neither the name Facebook nor the names of its contributors may be used to
   endorse or promote products derived from this software without specific
   prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
