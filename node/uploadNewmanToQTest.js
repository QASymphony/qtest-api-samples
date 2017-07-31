const commandLineArgs = require('command-line-args')
var request = require('request')
var fs = require('fs')

const optionDefinitions = [
  { name: 'file', alias: 'f', type: String },
  { name: 'format', alias: 'm', type: String, defaultValue: 'newman-json'},
  { name: 'usetestcaseid', alias: 'i', type: Boolean, defaultOption: false },
  { name: 'regex', alias: 'r', type: String, defaultValue: '(.*)' },
  { name: 'parentid', alias: 'p', type: String},
  { name: 'parenttype', alias: 't', type: String, defaultValue: 'root'},
  { name: 'credentials', alias: 'c', type: String},
  { name: 'help', alias: 'h', type: Boolean},
]

const options = commandLineArgs(optionDefinitions);

if(options.help) {
  var helptext = fs.readFileSync('help.txt', 'utf8');
  console.log(helptext);
  process.exit(0);  
}

HandleOptions(options, function(err) {
  if(err) {
    console.log(err)
    process.exit(-1)
  }
})

var creds = JSON.parse(fs.readFileSync('creds.json', 'utf8'));
Login(creds, findAndUploadResults);

function findAndUploadResults(creds, token, token_type) {
  var executionResults = ParseResultsFile();

  // Two fundamental ways to get matching test runs: Get ALL runs under the type/id using
  //
  // Way 1: Get all test runs under the specified tree root
  // 
  // https://qas.qtestnet.com/api/v3/projects/45625/test-runs?parentId=169619&parentType=release&expand=descendants
  // https://qas.qtestnet.com/api/v3/projects/45625/test-runs?parentId=169619&parentType=test-cycle&expand=descendants
  // https://qas.qtestnet.com/api/v3/projects/45625/test-runs?parentId=169619&parentType=test-suite&expand=descendants
  // note expand=descendents to get all children at any level
  // Now go through each and match the name or id of the test run to our results
  //
  // Way 2:
  // User the /search to get matching test-runs (implemented below)
  // 
  //"'Test Case Id' = '11633035' and Release = 'RL-1 Release 1'"
  //"'Name' = 'LongUsername' and Release = 'RL-1 Release 1'"

  executionResults.forEach(function(run, index) {
    
    // Get our matching test runs
    var query = "'Test Case Id' = '" + run.testcase + "'"; 
    if(!options.usetestcaseid) {
      query = "'Name' = '" + run.testcase + "'"; // Note that this is the name of the Test Case, not Test Run
    }

    // empty/anything else is root
    if(options.parentid) {
      if(options.parenttype = 'release') 
        query = query + " and Release Id = 'RL-" + options.parentid + "'";
      else if(options.parenttype = 'test-suite')
        query = query + " and Test Suite Id = 'TS-" + options.parentid + "'";
      else if(options.parenttype = 'test-cycle')
        query = query + " and Test Cycle Id = 'CL-" + options.parentid + "'";
    }

    var opts = {
      url: "https://" + creds.url + "/api/v3/projects/" + creds.project + "/search",
      json: true,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'bearer ' + token,
      },
      body: {
        object_type: 'test-runs',
        fields: ['*'],
        query: query
      }
    }

    request.post(opts, function(err, response, body) {
      if(err) {
        HandleErrorAndExit("Error querying parent folder: " + err)
      }
      else {
        if(body.total > 100) {
          HandleErrorAndExit("Returned more than 100 matching runs! This software isn't built to handle this... yet!")
        }
        else if(body.items.length == 0) {
          HandleErrorAndExit("No matching test runs found")
        }
        else {
          UploadResults(run, body.items, token)
        }
      }
    })
  })
}

// Accepts items, an array of test-run objects
// Could use Submit a Test Log or automation log depending on how you want your test cases linked
function UploadResults(run, items, token) {
  items.forEach(function(item, index) {
    var opts = {
      url: "https://" + creds.url + "/api/v3/projects/" + creds.project + "/test-runs/" + item.id + "/auto-test-logs",
      json: true,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'bearer ' + token,
      },
      body: {
        status: run.status,
        exe_start_date: new Date(),
        exe_end_date: new Date(),
        name: item.pid + " WHERE?",
        note: run.error ? run.error : "Successful automation run"
      }
    }

    request.post(opts, function(err, response, body) {
      if(err) {
        HandleErrorAndExit("Error uploading test result with values : " + JSON.stringify(opts) + "\n\nERROR: " + err)
      }
      else {
        console.log("Successfully uploaded test case [" + run.testcase + "] with status " + run.status + " to test run + " + item.pid)
      }
    })
  })
}

function ParseResultsFile() {
  var executionResults = [];
  
  if(options.format == 'newman-json') {
    var results = JSON.parse(fs.readFileSync(options.file, 'utf8'));

    // Loop through all test results in JSON file
    var testExecutions = results.run.executions;
    testExecutions.forEach(function(exec, index) {
      var reg = new RegExp(options.regex, 'i');
      var testname = exec.item.name
      match = reg.exec(testname);

      // If their regex doesn't match one of the tests - kill the entire thing & print err      
      if(!match) {
        console.log("No found match for test named: " + testname)
        HandleErrorAndExit("Try a new regex - group within ()'s not found, See -h for details.")
      }

      // Create the test run log that we will upload later
      var execution = {
        name: testname,
        status: 'PASS',
        testcase: match[0]
      };

      // Set pass unless one of the assertions has an error
      exec.assertions.forEach(function(assertion, i) {
        if(assertion.error) {
          execution.status = 'FAIL'
          if(execution.error) 
            execution.error = '\n'
          execution.error = execution.error + assertion.error.stack;
        }
      })

      executionResults.push(execution)
    })
  }

  if(options.format == 'newman-xml') {
    HandleErrorAndExit("Newman-xml is not yet implemented. Sorry!")
  }

  return executionResults
}


// Login and get token (basic authentication)
function Login(creds, callback) {
  // NOTE: The documentation says to leave the password empty here so 
  //   it's just the email and colon encoded
  var auth = 'Basic ' + new Buffer(creds.email + ':').toString('base64');

  var opts = {
    url: "http://" + creds.url + "/oauth/token",
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': auth
    },
    form: {
      grant_type: 'password',
      username: creds.email,
      password: creds.password
    }
  }

  request.post(opts, function(err, response, body) {
    if(err) {
      HandleErrorAndExit("Error logging in: " + err)
    }
    else {
      var jsonbody = JSON.parse(body);
      if(!jsonbody.access_token) {
        HandleErrorAndExit("Unable to log in: " + body)
      }

      //console.log("Logged in successfully: " + body)
      
      var token = jsonbody.access_token
      var token_type = jsonbody.token_type
      
      callback(creds, token, token_type)
    }
  })
}

function HandleErrorAndExit(err) {
  console.log(err)
  process.exit(-1)
}

// Deal with missing requirement command line parameters
function HandleOptions(options, cb) {
  if(!options.file) {
    cb('Missing required input file. Try -h for help')
  }

  if(!options.file) {
    cb('Missing required input file. Try -h for help')
  }

  if(!options.credentials) {
    cb('Missing required credentials file. Try -h for help')
  }
}