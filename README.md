This script generates [Eclipse Orion](http://eclipse.org/orion/) index files (using the [Tern format](http://ternjs.net/doc/manual.html#typedef)) for built-in modules from [node.js](http://nodejs.org/).  The script should be executed as follows:

> node node-index-gen.js doc_dir output_file

`doc_dir` should be the directory containing the node.js module documentation in JSON format.  If you clone the node repository and run `make doc`, the `out/doc/api` directory will contain the files.  

Note that the script substitutes the `Object` type whenever it can't discover an appropriate parameter or return type from the documentation (which is often).  Also, note that the end of the script contains some code to manually patch in more informative types for certain functions / methods, and can be enhanced as desired.
