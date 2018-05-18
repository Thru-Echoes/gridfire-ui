const express = require('express');
const fs = require('fs');
const pg = require("pg");
const crypto = require('crypto');
const edn = require('jsedn');
const util = require('util');

const router = express.Router();
const spawn = require('child_process').spawn;
const exec = require('child_process').exec;

/*****************************************************/
// Debugging 
const debugHttpIn = require('debug')('http:incoming');
const debugHttpOut = require('debug')('http:outgoing');

let outRequest = {
    url: 'localhost'
}

debugHttpOut('Request sent to %s ', outRequest.url);

let inRequest = {
    body: '{"status": "ok"}'
}

debugHttpOut('Receive body %s ', inRequest.body);

// start with: 
// $ DEBUG=http:incoming,http:outgoing npm start

/*****************************************************/
// Unique session id 

function createSessionId() {
    var sha = crypto.createHash('sha256');
    sha.update(Math.random().toString());
    return sha.digest('hex').substring(0, 20);
} 

/*****************************************************/
// Connection to PostgreSQL / PostGIS

var config = {
    user: 'gridfire',
    database: 'gridfire',
    password: '',
    host: 'localhost',
    port: 5432,
    max: 10, // max number of clients in the pool 
    idleTimeoutMillis: 300000 // time client idles before closing connection  
};

const pool = new pg.Pool(config);

/*****************************************************/

// STEP 1: Make SQL strings 

function makeCreateViewSQL(tableName, sessionId, lonMin, lonMax, latMin, latMax) {
    return  "CREATE VIEW clips." + tableName + "_" + sessionId + " AS \n" +
            "    WITH polygon AS (SELECT ST_Transform(ST_MakeEnvelope(" + lonMin + "," + latMin + "," + lonMax + "," + latMax + ",4326), 900914) AS geom) \n" +
            "        SELECT ST_Union(ST_Clip(rast, geom)) AS rast \n" +
            "            FROM landfire." + tableName + "\n" +
            "            CROSS JOIN polygon \n" + 
            "            WHERE ST_Intersects(rast, geom);";
}

function makeSTHeightSQL(tableName, sessionId) {
    return "SELECT ST_Height(rast) AS height FROM clips." + tableName + "_" + sessionId + ";";
} 

function makeSTWidthSQL(tableName, sessionId) {
    return "SELECT ST_Width(rast) AS width FROM clips." + tableName + "_" + sessionId + ";";
}

// STEP 2: Make SQL results

async function execSQL(query) {

    console.log("query: ", query);
    //let res = await pool.query(query);
    let client = await pool.connect();
    try {
        let res = await client.query(query);
        //console.log("\nres: ", res);
        return res;
    } catch(e) {
        console.error(e.stack);
    } finally {
        client.release();
    }
}

async function testCreateViews(sessionId) {

    // Sample values 
    var lonMin = -122.26791253211559;
    var lonMax = -122.25455112493366;
    var latMin = 37.869323470270075;
    var latMax = 37.874884960441165;

    // Res waits till execSQL promise resolves 
    let dims = await createViews(sessionId, lonMin, lonMax, latMin, latMax);

    // async execSQL is finished 
    console.log("\ntestCreateViews dims: ", dims);
}

// STEP 3: Get SQL results from step 2

async function createView(tableName, sessionId, lonMin, lonMax, latMin, latMax) {
    return await execSQL(makeCreateViewSQL(tableName, sessionId, lonMin, lonMax, latMin, latMax));
}

async function createViews(sessionId, lonMin, lonMax, latMin, latMax) {
    // FIXME: Need to add dem to tableNames !!  

    await createView('asp', sessionId, lonMin, lonMax, latMin, latMax);
    await createView('cbd', sessionId, lonMin, lonMax, latMin, latMax);
    await createView('cbh', sessionId, lonMin, lonMax, latMin, latMax);
    await createView('cc', sessionId, lonMin, lonMax, latMin, latMax);
    await createView('ch', sessionId, lonMin, lonMax, latMin, latMax);
    //await createView('dem', sessionId, lonMin, lonMax, latMin, latMax);
    await createView('fbfm40', sessionId, lonMin, lonMax, latMin, latMax);
    await createView('slp', sessionId, lonMin, lonMax, latMin, latMax);
    
    let dims = await getClipDims('asp', sessionId);

    //console.log("\ndims: ", dims);
    console.log("testAwait height: ", dims.height);
    console.log("testAwait width: ", dims.width);

    return dims;
}

async function getClipDims(tableName, sessionId) {
    
    let heightResult = await execSQL(makeSTHeightSQL(tableName, sessionId));
    let widthResult = await execSQL(makeSTWidthSQL(tableName, sessionId));

    //console.log("\ngetClipDims heightResult: ", heightResult);
    //console.log("getClipDims widthResult: ", widthResult);

    console.log("heightResult[rows][0]: ", heightResult['rows'][0]['height']);
    console.log("widthResult[rows][0]: ", widthResult['rows'][0]['width']);
    
    return {
        height: heightResult['rows'][0]['height'],
        width: widthResult['rows'][0]['width']
    };
}

/*****************************************************/
// Check user params for EDN 
var checkVals = function (val) {

    if (validateEdnInput(val)) {
        return edn.parse(val);
    } else {
        // User input ERROR 
        console.log("\nERROR...val is no good.\n");
        //return null; 
        throw "Parameter is not a valid scalar, (list), or [vector]."; 
    }
}

// Gary code for POST validation - return TRUE / FALSE 

function isValidList (form) {
    return typeof form == "object" &&
        !Array.isArray(form) &&
        Object.keys(form).length == 1 &&
        Object.keys(form)[0] == "val" &&
        form instanceof edn.List &&
        form["val"].length > 0 &&
        form["val"].every(function (x) { return typeof x == "number";});
}

function isValidVector (form) {
    return typeof form == "object" &&
        !Array.isArray(form) &&
        Object.keys(form).length == 1 &&
        Object.keys(form)[0] == "val" &&
        form instanceof edn.Vector && 
        form["val"].length == 2 &&
        form["val"].every(function (x) { return typeof x == "number";});
}

function isValidScalar (form) {
    return typeof form == "number";
}

function validateEdnInput (input) {
    //var form = edn.encodeJson(edn.parse(input));
    var form = edn.parse(input);
    return isValidList(form) || isValidVector(form) || isValidScalar(form);
}

/*****************************************************/

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'GridFire Interface', error: null });
});

/* POST event */
router.post('/', async function(req, res) {

    var sessionId = createSessionId();

    /* Send POST to .edn file for Clojure */

    try {

        // Single vs random burn sites 
        var checkRadio = req.body.radio;
        var ignitionLat = '';
        var ignitionLon = '';
        var lonMin = '';
        var lonMax = '';
        var latMin = '';
        var latMax = '';

        if (checkRadio == 'isSingle') {
            ignitionLat = req.body['ignition-lat'];
            ignitionLon = req.body['ignition-lon'];

            // Postgres: get point as text from GeoJSON
            var exGeoPoint = '{"type":"Point","coordinates":[-48.23456,20.12345]}';
            var geoPoint = '{"type":"Point","coordinates":[' + ignitionLon + ',' + ignitionLat + ']}';
            getGeoPointQuery(geoPoint);

            /*var getHeight = getHeightQuery('ch');
            var getWidth = getWidthQuery('ch');

            console.log("\n\ngetHeight: ", getHeight);
            console.log("getWidth: ", getWidth);
            console.log("\n\n");*/

        } else {

            lonMin = req.body['lon-min'];
            lonMax = req.body['lon-max'];
            latMin = req.body['lat-min'];
            latMax = req.body['lat-max'];

            //ignitionLat = latMin + ',' + latMax;
            //ignitionLon = lonMin + ',' + lonMax;
            
            // Postgres: create view with geoPolygon
            var latMinParse = JSON.parse(latMin);
            var latMaxParse = JSON.parse(latMax);
            var lonMinParse = JSON.parse(lonMin);
            var lonMaxParse = JSON.parse(lonMax);

            var dims = await createViews(sessionId, lonMinParse, lonMaxParse, latMinParse, latMaxParse);
            
            ignitionRow = '[0 ' + dims.height + ']';
            ignitionCol = '[0 ' + dims.width + ']';

            console.log("\nignitionRow: ", ignitionRow);
            console.log("ignitionCol: ", ignitionCol);
            console.log("\n");
        }

        var maxRuntime = req.body['max-runtime'];
        var temperature = req.body['temperature'];
        var relativeHumidity = req.body['relative-humidity'];
        var windSpeed20ft = req.body['wind-speed-20ft'];
        var windFromDirection = req.body['wind-from-direction'];
        var foliarMoisture = req.body['foliar-moisture'];
        var ellipseAdjustmentFactor = req.body['ellipse-adjustment-factor'];
        var simulations = req.body['simulations'];
        var randomSeed = req.body['random-seed'];

        // Convert JS to EDN object (Map) 
        var ednMap = new edn.Map([edn.kw(":db-spec"), 
                            new edn.Map([edn.kw(":classname"), "org.postgresql.Driver",
                                edn.kw(":subprotocol"), "postgresql",
                                edn.kw(":subname"), "//localhost:5432/gridfire",
                                edn.kw(":user"), "gridfire"]),
                            edn.kw(":landfire-layers"),
                            new edn.Map([edn.kw(":elevation"), "clip.dem_" + sessionId,
                                edn.kw(":slope"), "clip.slp_" + sessionId,
                                edn.kw(":aspect"), "clip.asp_" + sessionId,
                                edn.kw(":fuel-model"), "clip.fbfm40_" + sessionId,
                                edn.kw(":canopy-height"), "clip.ch_" + sessionId,
                                edn.kw(":canopy-base-height"), "clip.cbh_" + sessionId,
                                edn.kw(":crown-bulk-density"), "clip.cbd_" + sessionId,
                                edn.kw(":canopy-cover"), "clip.cc_" + sessionId]),
                                    edn.kw(":srid"), "CUSTOM:900914",
                                    edn.kw(":cell-size"), 98.425,
                                    edn.kw(":ignition-row"), checkVals(ignitionRow), 
                                    edn.kw(":ignition-col"), checkVals(ignitionCol),
                                    edn.kw(":max-runtime"), checkVals(maxRuntime),
                                    edn.kw(":temperature"), checkVals(temperature),
                                    edn.kw(":relative-humidity"), checkVals(relativeHumidity),
                                    edn.kw(":wind-speed-20ft"), checkVals(windSpeed20ft),
                                    edn.kw(":wind-from-direction"), checkVals(windFromDirection),
                                    edn.kw(":foliar-moisture"), checkVals(foliarMoisture),
                                    edn.kw(":ellipse-adjustment-factor"), checkVals(ellipseAdjustmentFactor),
                                    edn.kw(":simulations"), checkVals(simulations),
                                    edn.kw(":random-seed"), checkVals(randomSeed),
                                    //edn.kw(":outfile-suffix"), "_tile_100",
                                    edn.kw(":outfile-suffix"), "_" + sessionId,
                                    edn.kw(":output-landfire-inputs?"), true,
                                    edn.kw(":output-geotiffs?"), true,
                                    edn.kw(":output-pngs?"), true,
                                    edn.kw(":output-csvs?"), true]);

        // Encode EDN Map
        var ednObj = edn.encode(ednMap);
        var fileName = "model_params_" + sessionId + ".edn";

        fs.writeFile(fileName, ednObj, function(err, ednObj) {
            if (err) console.log(err);
            console.log("\nWrote params to file " + fileName);
        });

        /*****************************************************/
        // Run GridFire
        
        // With util spawn (stream output back to client)

        function spawnShell (shellCmd) {
            var spawnInst = spawn(shellCmd);
            spawnInst.stdout.on("data", function (data) {
                console.log("stdout: " + data);
            });
    
            spawnInst.stderr.on("data", function (data) {
                console.log("stderr: " + data);
            });
    
            spawnInst.on("exit", function (code) {
                console.log("Child process exited with code " + code);
            });
        }

        /*var spawnList = spawn("ls -la");
        spawnList.stdout.on("data", function (data) {
            console.log("spawnList stdout: " + data);
        });
        spawnList.stderr.on("data", function (data) {
            console.log("spawnList stderr: " + data);
        });
        spawnList.on("exit", function (code) {
            console.log("spawnList child process exited with code " + code);
        });*/

        // With util exec (buffers output)

        function execShell(shellCmd) {
            var shellExec = exec(shellCmd, function(err, stdout, stderr) {
                if (err) {
                    console.error(err);
                }
                console.log("\nStdout of " + shellCmd);
                console.log(stdout);
            })

            shellExec.on("exit", function (exitCode) {
                console.log("exitCode: " + exitCode);
            });
        }

        //var gridFireBoot = "cd ../../gridfire/ && boot build";
        //var gridFireRun = "java -jar ../../gridfire/target/gridfire-1.5.0.jar model_params_" + sessionId + ".edn";
        var gridFireRun = "java -jar resources/gridfire.jar model_params_" + sessionId + ".edn";

        execShell("ls");               // test shell cmd 
        //execShell(gridFireBoot);
        execShell(gridFireRun);

        //res.render('index', { title: 'GridFire Interface', error: null });
        res.redirect('/');

    } catch(err) {

        console.log("\n\nCatch(err) POST event");
        console.log("err: ", err);
        console.log("\n\n");

        res.render('index', { title: 'GridFire Interface', error: err });
        //res.redirect('/');
    }
})

module.exports = router;

/* 

// See clips 
\dv clips.

// Drop clips 
DROP VIEW clips.ch_0747edad5a9a49e66ee14a2339e9769b983f82aca2dde73b79465b74df91;

// Check out clips 
SELECT ST_AsText(ST_Envelope(rast)) FROM clips.ch_42459c3530f6eb22a4bf;

// Check out summarystats of clips 
SELECT (ST_SummaryStats(rast)).* FROM clips.ch_42459c3530f6eb22a4bf;

// Check projection 
SELECT ST_SRID(rast) AS foo FROM landfire.ch LIMIT 10;

// Change projection
SELECT ST_SRID(rast) AS foo FROM landfire.ch LIMIT 10;

// Reproject all rasters 
for LAYER in asp cbh cc fbfm40 slp
    do psql -U kschocz -d gridfire -c \
        "SELECT UpdateRasterSRID('landfire'::name,'$LAYER'::name,'rast'::name,900914);" &
    done

*/ 
