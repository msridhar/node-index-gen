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
		if (params[i].optional) {
			// only respect flag if remaining parameters are also
			// optional
			// TODO MS optimize if needed
			var remainingOptional = true;
			for (var j = i+1; j < params.length; j++) {
				if (!params[j].optional) {
					remainingOptional = false;
					break;
				}
			}
			if (remainingOptional) {
				paramName += "?";			
			}
		}
		result +=  paramName + ": Object";
		if (i < params.length-1) {
			result += ", ";
		}
	}
	result += ")";
	if (sig["return"]) {
		var returnType = sig["return"].type;
		if (returnType) {
			if (returnType.indexOf("|") !== -1) {
				// just pick the first one
				returnType = returnType.substring(0, returnType.indexOf("|"));
			}
			returnType = returnType.replace(/\s+/g, '');
			result += " -> " + returnType;
		}
	}
	return result;
}

function processMethod(meth, result) {
	var name = meth.name;
	var sig = meth.signatures[0];
	var fnSig = genFnSig(sig);
	result[name] = {
		"!type": fnSig
	};	
}

function processModule(m) {
	var result = null;
	if (m.methods) {
		result = {};
		m.methods.forEach(function (meth) {
			processMethod(meth,result);
		});
	}
	if (m.classes) {
		if (!result) {
			result = {};
		}
		m.classes.forEach(function (klass) {
			var name = klass.name;
			// just take the part after the final '.'
			if (name.indexOf(".") !== -1) {
				name = name.substring(name.lastIndexOf(".")+1,name.length);
			}
			var klassMethods = {};
			if (klass.methods) {
				klass.methods.forEach(function (meth) {
					processMethod(meth, klassMethods);
				});
			}
			result[name] = {
				// assume a no-argument constructor for now
				"!type": "fn()",
				"prototype": klassMethods
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

// manual patches; try to minimize these
typesObj.Process = {
	"stdout": {
		"!type": "+stream.Writable"
	}
};
typesObj.fs.openSync = {
	"!type": "fn(path: Object, flags: Object, mode?: Object) -> Number"
};

indexObj["!define"] = typesObj;
var indexFileStr = "define(\"plugins/esprima/indexFiles/cleanNodeIndex\", [], function () {\n" +
	"return " + JSON.stringify(indexObj, null, '\t') + ";\n});";
console.log(indexFileStr);




