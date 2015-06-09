
all: reconcile.js reconcile.min.js

reconcile.js: Makefile
	@rm -f reconcile.js
	@babel --modules umdStrict lib/reconcile.js > reconcile.js

%.min.js:: Makefile
	@rm -f *.min.js
	@babel --compact umdStrict lib/reconcile.js > reconcile.min.js

clean:
	@rm -rf reconcile.js reconcile.min.js

test:
	@karma start
