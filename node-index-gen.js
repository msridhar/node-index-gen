/*******************************************************************************
 * @license
 * Copyright (c) 2013 IBM Corporation.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*jslint node:true */

var fs = require('fs'),
    path = require('path');

/**
 * copy properties from src obj to dst obj
 */
function extend(dst, src) {
	Object.keys(src).forEach(function (p) {
		dst[p] = src[p];
	});
}

/**
 * given a signature object from node.js JSON docs,
 * generate a string function signature suitable for
 * an index file
 */
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

function processProperty(prop, result) {
	var name = prop.name;
	// TODO try to parse a type?
	result[name] = {
		"!type": "Object"
	};
}

function processMethodsAndProperties(m, result) {
	if (m.methods) {
		m.methods.forEach(function (meth) {
			processMethod(meth,result);
		});
	}
	if (m.properties) {
		m.properties.forEach(function (prop) {
			processProperty(prop,result);
		});		
	}
}
function processModule(m) {
	var result = {};
	processMethodsAndProperties(m, result);
	if (m.classes) {
		m.classes.forEach(function (klass) {
			var name = klass.name;
			// just take the part after the final '.'
			if (name.indexOf(".") !== -1) {
				name = name.substring(name.lastIndexOf(".")+1,name.length);
			}
			var klassTypes = {};
			processMethodsAndProperties(klass, klassTypes);
			var klassMethods = {};
			if (klass.classMethods) {
				klass.classMethods.forEach(function (meth) {
					processMethod(meth,klassMethods);
				});
			}
			var klassResult = {
				// assume a no-argument constructor for now
				"!type": "fn()",
				"prototype": klassTypes
			};
			extend(klassResult, klassMethods);
			result[name] = klassResult;
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
var outputFile = process.argv[3];
var files = fs.readdirSync(docDir);

var typesObj = {};
var indexObj = {};

files.forEach(function (filename) {
	if (path.extname(filename) === ".json") {
		var moduleName = path.basename(filename, ".json");
		if (!excluded[moduleName]) {
			var docJSON = JSON.parse(fs.readFileSync(docDir + "/" + filename) + "");
			if (docJSON.modules && docJSON.modules[0]) {
				var moduleResults = processModule(docJSON.modules[0]);
				if (Object.keys(moduleResults).length > 0) {
					typesObj[moduleName] = moduleResults;
				} 
			}
			if (docJSON.globals) {
				docJSON.globals.forEach(function (glob) {
					var name = glob.name;
					var globTypes = {};
					processMethodsAndProperties(glob, globTypes);
					// we capitalize the global name as the type name.
					// hopefully this won't lead to conflicts
					var globTypeName = name.charAt(0).toUpperCase() + name.slice(1);
					typesObj[globTypeName] = globTypes;
					indexObj[name] = globTypeName;
				});
			}	

		} 
	}
});


indexObj["!define"] = typesObj;

// manual patches; try to minimize these
extend(indexObj, {
		"!name": "node",
		"this": "<top>",
		"global": "<top>",
		"buffer": "buffer",
		"Buffer": "buffer.Buffer",
		"require": {
			"!type": "fn(name: String) -> Object"
		},
		"__filename": "String",
		"__dirname": "String",
		"module": "Object",
		"exports": "Object",
		"setTimeout": {
			"!type": "fn(cb: Object, ms: Number) -> Object"
		},
		"clearTimeout": {
			"!type": "fn(t: Object)"
		},
		"setInterval": {
			"!type": "fn(cb: Object, ms: Number) -> Object"
		},
		"clearInterval": {
			"!type": "fn(t: Object)"
		}
		
});

typesObj.Process.stdout = {
	"!type": "+stream.Writable"
};
typesObj.fs.openSync = {
	"!type": "fn(path: Object, flags: Object, mode?: Object) -> Number"
};
typesObj.buffer.INSPECT_MAX_BYTES = {
	"!type": "Number"
};

var header = "/*******************************************************************************\n" + 
			" * @license\n" + 
			" * Copyright (c) 2013 IBM Corporation.\n" + 
			" * All rights reserved. This program and the accompanying materials are made\n" + 
			" * available under the terms of the Eclipse Public License v1.0\n" + 
			" * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution\n" + 
			" * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html).\n" + 
			" *\n" + 
			" * Contributors:\n" + 
			" *     Manu Sridharan (IBM) - Initial API and implementation\n" + 
			" ******************************************************************************/\n" +
			" /*global define */\n";
var indexFileStr = header + "define(\"plugins/esprima/indexFiles/nodeIndex\", [], function () {\n" +
	"return " + JSON.stringify(indexObj, null, '\t') + ";\n});";

fs.writeFileSync(outputFile, indexFileStr);





