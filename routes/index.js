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
// Show GridFire running status 

// Change HTML alert status based on GridFire
function gridFireRunning() {
    document.getElementById("gridFireDone").style.display = "none";
    document.getElementById("gridFireRunning").style.display = "block";
} 

// Show GridFire done status

function gridFireDone() {
    document.getElementById("gridFireRunning").style.display = "none";
    document.getElementById("gridFireDone").style.display = "block";
}


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

// See GridFire results on map 
function makeSTMetaDataSQL(tableName, sessionId) {
    return "SELECT (ST_Metadata(rast)).* FROM clips." + tableName + "_" + sessionId + ";";
}

// STEP 2: Make SQL results

async function execSQL(query) {

    console.log("\nquery: " + query + "\n");
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
    await createView('dem', sessionId, lonMin, lonMax, latMin, latMax);
    await createView('fbfm40', sessionId, lonMin, lonMax, latMin, latMax);
    await createView('slp', sessionId, lonMin, lonMax, latMin, latMax);
    
    let dims = await getClipDims('asp', sessionId);

    return dims;
}

async function getClipDims(tableName, sessionId) {
    
    let heightResult = await execSQL(makeSTHeightSQL(tableName, sessionId));
    let widthResult = await execSQL(makeSTWidthSQL(tableName, sessionId));
    
    return {
        height: heightResult['rows'][0]['height'],
        width: widthResult['rows'][0]['width']
    };
}

async function getClipMetaData(tableName, sessionId) {
    let metaData = await execSQL(makeSTMetaDataSQL(tableName, sessionId));

    return {
        upperLeftX: metaData['rows'][0]['upperleftx'],
        upperLeftY: metaData['rows'][0]['upperlefty'],
        width: metaData['rows'][0]['width'],
        height: metaData['rows'][0]['height'],
        scaleX: metaData['rows'][0]['scalex'],
        scaleY: metaData['rows'][0]['scaley']
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
    res.render('index', { title: 'GridFire Interface', error: null, sessionId: "null", validSims: "null", extent: "null" });
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

            /* FIXME: what size bounding box around single ignition site (using +/- 0.05) */
            
            lonMin = JSON.parse(ignitionLon) - 0.05;
            lonMax = JSON.parse(ignitionLon) + 0.05;
            latMin = JSON.parse(ignitionLat) - 0.05;
            latMax = JSON.parse(ignitionLat) + 0.05;

            // Postgres: create view with geoPolygon

            var dims = await createViews(sessionId, lonMin, lonMax, latMin, latMax);
            
            ignitionRow = '[0 ' + dims.height + ']';
            ignitionCol = '[0 ' + dims.width + ']';

            console.log("\n(Single ignition) ignitionRow: " + ignitionRow);
            console.log("ignitionCol: " + ignitionCol + "\n");

            // Postgres: get point as text from GeoJSON
            /*var exGeoPoint = '{"type":"Point","coordinates":[-48.23456,20.12345]}';
            var geoPoint = '{"type":"Point","coordinates":[' + ignitionLon + ',' + ignitionLat + ']}';
            getGeoPointQuery(geoPoint);*/

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

            console.log("\nignitionRow: " + ignitionRow);
            console.log("ignitionCol: " + ignitionCol + "\n");
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
                            new edn.Map([edn.kw(":elevation"), "clips.dem_" + sessionId,
                                edn.kw(":slope"), "clips.slp_" + sessionId,
                                edn.kw(":aspect"), "clips.asp_" + sessionId,
                                edn.kw(":fuel-model"), "clips.fbfm40_" + sessionId,
                                edn.kw(":canopy-height"), "clips.ch_" + sessionId,
                                edn.kw(":canopy-base-height"), "clips.cbh_" + sessionId,
                                edn.kw(":crown-bulk-density"), "clips.cbd_" + sessionId,
                                edn.kw(":canopy-cover"), "clips.cc_" + sessionId]),
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
        var fileName = "public/model/model_params_" + sessionId + ".edn";

        fs.writeFile(fileName, ednObj, function(err, ednObj) {
            if (err) console.log(err);
            console.log("\nWrote params to file " + fileName);
        });

        /*****************************************************/
        // Run GridFire
        
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
                showMapResults(sessionId);
            });
        }

        //var gridFireBoot = "cd ../../gridfire/ && boot build";
        var gridFireRun = "cd public/model && java -jar gridfire.jar model_params_" + sessionId + ".edn";

        execShell(gridFireRun);

        async function showMapResults(sessionId) {

            // PostgreSQL (in async fn)
            // SELECT (ST_Metadata(rast)).* FROM clips.asp_684422af4af02910806d;
            // SELECT (ST_Metadata(rast)).* FROM clips.asp_<sessionId>;

            let metaData = await getClipMetaData("asp", sessionId);

            //console.log("\nshowMapResults metaData: " + metaData);

            // Get extent [left, bottom, right, top] 
            /*var upperLeftX = -2254890;      
            var upperLeftY = 1955790;
            var flameWidth = 152;       // pixel - width (from psql) 
            var flameHeight = 129;      // pixel steps - height (from psql)
            var scaleX = 30;            // meters (from psql)
            var scaleY = -30;           // meters (from psql)

            var flameBottom = upperLeftY + scaleY * flameHeight;
            var flameRight = upperLeftX + scaleX * flameWidth;*/

            var bottom = metaData.upperLeftY + metaData.scaleY * metaData.height;
            var right = metaData.upperLeftX + metaData.scaleX * metaData.width;

            var extent = [metaData.upperLeftX, bottom, right, metaData.upperLeftY];

            console.log("\nshowMapResults extent: ", extent);
            
            var makeRange = function (min, max) {
                return Array.apply(null, {length: max + 1}).map(Number.call, Number).slice(min);
            };

            var validSims = makeRange(1, simulations)
                .map(
                    function (sim) {
                        if (fs.existsSync('public/model/flame_length_' + sessionId + '_' + sim + '.tif')) {
                            // gdaldem color .tif to .tif 
                            // 'gdaldem color-relief flame_length_<sessionId>_<sim>.tif color.txt flame_length_<sessionId>_<sim>.tif -alpha'
                            
                            // gdal_translate .tif to .png
                            let shellCmd = 'cd public/model/ && gdaldem color-relief -of PNG flame_length_' + sessionId + '_' + sim + '.tif ../../resources/color.txt flame_length_' + sessionId + '_' + sim + '.png -alpha';
                            //let shellCmd = 'cd public/model/ && gdal_translate -of PNG flame_length_' + sessionId + '_' + sim + '.tif flame_length_' + sessionId + '_' + sim + '.png';
                            let shellExec = exec(shellCmd, function(err, stdout, stderr) {
                                if (err) {
                                    console.error(err);
                                }
                                console.log("\nStdout of " + shellCmd);
                                console.log(stdout);
                            });
                
                            shellExec.on("exit", function (exitCode) {
                                console.log("exitCode: " + exitCode);
                            });
                            return sim;
                        } else {
                            return null;
                        }
                    }
                ).filter(
                    function (sim) {
                        return sim !== null;
                    }
                );

            console.log("\nvalidSims: " + validSims);

            // FIXME: send params as obj postParams to res.render to show in form field client side

            res.render('index', { title: 'GridFire Interface', error: null, 
                sessionId: JSON.stringify(sessionId), validSims: JSON.stringify(validSims), 
                extent: JSON.stringify(extent) });
        }
    } catch(err) {

        console.log("\n\nCatch(err) POST event");
        console.log("err: ", err);
        console.log("\n\n");

        res.render('index', { title: 'GridFire Interface', error: err, sessionId: "null", validSims: "null", extent: "null" });
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
