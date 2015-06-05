# Reconcile.js
Reconcile is a simple diff, patch and merge implementation that leverages
the reconciliation concept algorithm presented from Facebook's React.js library.
The goal of this library is to provide a very simple utility for performing diffs,
patches and merges of html documents. The strategy is done such that you should be able
to perform two-way or three-way merges depending on the context.

### Diff Nodes
Based on Facebook's Reconciliation algorithm, the approach for a O(n) diff and merge  
algorithm is much preferred over traditional tree diff algorithms. Reconciliation will
treat each node as unique in the context of its type, attributes, tags and content. When
performing a diff and patch, the implementation will generate an array of actions that
were made when transforming a given target content to the source element. Additionally,
to avoid having to iterate over the elements a second time, we transform the target node
to speed up the process while we are generating the diff itself. To generate a diff and merge
the changes from source to target, use the following code:

```
reconcile.merge(source, target);
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
