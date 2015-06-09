
all: reconcile.js reconcile.min.js

reconcile.js: Makefile
	@rm -f reconcile.umd.js
	@babel --modules umdStrict lib/reconcile.js > reconcile.umd.js

%.min.js:: Makefile
	@rm -f *.min.js
	@babel --compact umdStrict lib/reconcile.js > reconcile.umd.min.js

clean:
	@rm -rf reconcile.umd.js reconcile.umd.min.js

test:
	@karma start
