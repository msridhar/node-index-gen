/*jslint node:true */

var fs = require('fs'),
    path = require('path');

function genFnSig(sig) {
	var result = "fn(";
	var params = sig.params;
	for (var i = 0; i < params.length; i++) {
		var paramName = params[i].name;
		paramName = paramName.replace("...", "").replace(/\s+/g, '');
		if (paramName === "") {
			paramName = "other";
		}
		result +=  paramName + ": Object";
		if (i < params.length-1) {
			result += ", ";
		}
	}
	result += ")";
	return result;
}

function processModule(m) {
	var result = null;
	if (m.methods) {
		result = {};
		m.methods.forEach(function (meth) {
			var name = meth.name;
			var sig = meth.signatures[0];
			var fnSig = genFnSig(sig);
			result[name] = {
				"!type": fnSig
			};
		});
	}
	return result;
}

var excluded = {
	"all": true,
	"addons": true,
	"documentation": true,
	"globals": true,
	"synopsis": true,
	"_toc": true
};

var docDir = process.argv[2];
var files = fs.readdirSync(docDir);

var typesObj = {};

files.forEach(function (filename) {
	if (path.extname(filename) === ".json") {
		var moduleName = path.basename(filename, ".json");
		if (!excluded[moduleName]) {
			var docJSON = JSON.parse(fs.readFileSync(docDir + "/" + filename) + "");
			if (docJSON.modules && docJSON.modules[0]) {
				var moduleIndex = processModule(docJSON.modules[0]);
				if (moduleIndex) {
					typesObj[moduleName] = moduleIndex;
				}
			}
		}
	}
});
//var indexFileStr = "define(\"plugins/esprima/indexFiles/cleanNodeIndex\", [], function () {\n"
//	+ "return {\n"
//	+	"\"!name\": \"node\",\n"
//	+	"\"!define\":";


var indexObj = {
		"!name": "node",
		"this": "<top>",
		"global": "<top>",
		"process": "Process"
};

typesObj.Process = {
	"stdout": {
		"!type": "+stream.Writable"
	}
};
indexObj["!define"] = typesObj;
var indexFileStr = "define(\"plugins/esprima/indexFiles/cleanNodeIndex\", [], function () {\n" +
	"return " + JSON.stringify(indexObj, null, '\t') + ";\n});";
console.log(indexFileStr);




