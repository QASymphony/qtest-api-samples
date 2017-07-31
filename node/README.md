# Node - uploadNewmanToQTest

SETUP

	Install Node & npm
    Run npm install in this directory

NAME

    uploadNewmanToQTest

SYNOPSIS

    uploadNewmanToQTest [options]

DESCRIPTION

    Uploads the given files to qTest Manager as test execution results linking to existing test cases

USAGE

    -f file             Test result file

    -m format           Format of test result file, options are: newman-json, newman-xunit

    -i usetestcaseid    If true, will assume name of test result is the test case ID (fastest)
                        If false, will assume name of test result is the test case name

    -r regex            Where the ID or name is looked for (based on usetestcaseid)
                        By default it is the entire test case name

                        Example: (\D+)* if we're looking for digits at the start
                        TC_Name_(.+)$ if we're looking for a name after the words 
                        TC_Name_ to the end

    -p parentid         This will look for a matching Release, then Test Cycle, 
                        then Test Suite for a matching name
                        This will be the directory structure we will look under
                        for matching test executions

                        NOTE: If a test execution appears twice, BOTH execution results will be added
    
    -t parenttype       The tyep of folder to look in to store the test results. this is related to parentid
                        Values can be 'release' 'test-suite' or 'test-cycle'
    
    -c credentials      The file that has the appropriate qTest Credentials for this script.
                        It should be json content like:
                        {
                        email: "Elise",
                        password: "password",
                        qtesturl: "https://qas.qtestnet.com",
                        project: "API Automation Integration Demo Project"
                        }

EXAMPLE

	For the .json results file within this folder, create a creds.json file that looks like:	    
	{
        "email": "your@qTestLogin",
        "password": "yourqTestPassword",
        "url": "your.qtest.url.without.the.http.protocol.com",
        "project": theIDOfYourProjectThatYouCanGetFromTheURL
    }
    
    Update the test case results in this file to have test case IDs to match what is in your project where there are corresponding test runs under root. You can find the test case IDs in the sample results below.
    
	node uploadNewmanToQTest.js -f newman-json-result.json -c creds.json -i true -r "([0-9]+)\-*?"
    
    Output:
    Successfully uploaded test case [11645499] with status PASS to test run + TR-44
	Successfully uploaded test case [11633398] with status PASS to test run + TR-45
	Successfully uploaded test case [11633398] with status PASS to test run + TR-23
	Successfully uploaded test case [11633399] with status PASS to test run + TR-24
	Successfully uploaded test case [11633035] with status PASS to test run + TR-26
	Successfully uploaded test case [11633035] with status PASS to test run + TR-26
	Successfully uploaded test case [11633202] with status FAIL to test run + TR-25

