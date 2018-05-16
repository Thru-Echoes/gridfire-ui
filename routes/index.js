var express = require('express');
var router = express.Router();
var fs = require('fs');
var jsdom = require('jsdom');
var $ = require('jquery')(new jsdom.JSDOM().window);
var geotools = require('geojson-tools');

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
var crypto = require('crypto');

var generate_session_id = function() {
    var sha = crypto.createHash('sha256');
    sha.update(Math.random().toString());
    return sha.digest('hex');
}

var full_session_id = generate_session_id();
var session_id = full_session_id.substring(0, 20);

console.log("\n----------\nSession_id for this user: ", session_id);
console.log("\n\n"); 

// Javascript implementation of EDN for Clojure
var edn = require('jsedn');


/*****************************************************/
// Connection to PostgreSQL / PostGIS 
const pg = require("pg");

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

// async query 

async function query (q) {
    const client = await pool.connect();
    let res = await client.query(q);
    client.release();
    return res;
}

async function getQuery () {
    const { rows } = await query("SELECT count(*) FROM landfire.ch;");
    console.log("\n\nWithin getQuery()");
    console.log("JSON.stringify(rows): ", JSON.stringify(rows));
    console.log("\n\n");
}

async function getGeoPointQuery(geoPoint) {

    // Extract GeoJSON point as text
    var queryTxt = "SELECT ST_AsText(ST_GeomFromGeoJSON('" + geoPoint + "')) AS wkt;";
    //const { rows } = await query("SELECT ST_AsText(ST_GeomFromGeoJSON(" + geoPoint + ")) AS wkt;");
    const { rows } = await query(queryTxt);

    console.log("\nWithin getGeoPointQuery()");
    console.log("JSON.stringify(rows): ", JSON.stringify(rows));
    console.log("\n\n");
}

//async function getCreateViewQuery(tableName, geoPolygon) {
async function getCreateViewQuery(tableName, lonMin, lonMax, latMin, latMax) {

    console.log("\n\nWithin getCreateViewQuery()");
    console.log("lonMin: ", lonMin);
    console.log("lonMax: ", lonMax);
    console.log("latMin: ", latMin);
    console.log("latMax: ", latMax);

    var queryTxt = "CREATE VIEW clips." + tableName + "_" + session_id + " AS \n" +
                   "    WITH polygon AS (SELECT ST_Transform(ST_MakeEnvelope(" + lonMin + "," + latMin + "," + lonMax + "," + latMax + ",4326), 900914) AS geom) \n" +
                   "        SELECT ST_Union(ST_Clip(rast, geom)) AS rast \n" +
                   "            FROM landfire." + tableName + "\n" +
                   "            CROSS JOIN polygon \n" + 
                   "            WHERE ST_Intersects(rast, geom);";

    const { rows } = await query(queryTxt);

    console.log("\nWithin getCreateViewQuery()");
    console.log("JSON.stringify(rows): ", JSON.stringify(rows));
    console.log("\n\n");
    
    // SQL for PostGIS

    /*
    -- CREATE VIEW schema.table (~= namespace/var in Clojure)
    -- e.g. clips = schema, canpoy_height = table 
    -- CREATE VIEW => non-caches, run everytime (non-memoized)
    -- CREATE TABLE => caches (memoized)
    CREATE VIEW clips.<table_name>_<session_id> AS
    -- Create vars | Need to convert string to PostGIS geometry obj
    WITH geom AS ST_GeomFromGeoJSON(<geojson_polygon>)
        -- ST_Clip applies to each tile
        -- ST_Union aggregates (union) all clipped tiles into 1 tile
        SELECT ST_Union(ST_Clip(rast, geom)) AS rast
        -- landfire.<table_name> sequence of maps {:rid int :rast raster}
        FROM landfire.<table_name>
        WHERE ST_Intersects(rast, geom);
        -- LIMIT 10; -- same Clojure (take 10)
        -- WHERE => Clojure (filter ST_Intersects())
        -- FROM => sequence generator
        -- ORDER BY => Clojure (sort) or (sort-by)
        -- e.g. ORDER BY <field> (age)
        -- WITH => (Clojure let) bind names to exp [sequence calls]
        -- CREATE => (Clojure def)
        -- SELECT => (Clojure Map or Reduce)

    -- raster2pgsql -t width x height (-t = tiles raster)
    -- one CREATE VIEW for each LANDFIRE layer
    -- Within .edn file calls clips.canopy_height_<session_id>
    */
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

/* GET home page. */
router.get('/', function(req, res, next) {

    // Simple Postgres query 
    getQuery();

    res.render('index', { title: 'GridFire Interface', error: null });
});

/* POST event */
router.post('/', function(req, res) {

    console.log("\n\nIn POST event");

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

        } else {

            lonMin = req.body['lon-min'];
            lonMax = req.body['lon-max'];
            latMin = req.body['lat-min'];
            latMax = req.body['lat-max'];

            ignitionLat = latMin + ',' + latMax;
            ignitionLon = lonMin + ',' + lonMax;
            
            // Postgres: create view with geoPolygon
            var latMinParse = JSON.parse(latMin);
            var latMaxParse = JSON.parse(latMax);
            var lonMinParse = JSON.parse(lonMin);
            var lonMaxParse = JSON.parse(lonMax);  
            
            var tableNames = ['asp', 'cbd', 'cbh', 'cc', 'ch', 'fbfm40', 'slp'];

            tableNames.forEach(
                function (tableName) {
                    getCreateViewQuery(tableName, lonMinParse, lonMaxParse, latMinParse, latMaxParse);
                }
            );

            //getCreateViewQuery(tableName, lonMinParse, lonMaxParse, latMinParse, latMaxParse);

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
                            new edn.Map([edn.kw(":elevation"), "clip.dem_" + session_id,
                                edn.kw(":slope"), "clip.slp_" + session_id,
                                edn.kw(":aspect"), "clip.asp_" + session_id,
                                edn.kw(":fuel-model"), "clip.fbfm40_" + session_id,
                                edn.kw(":canopy-height"), "clip.ch_" + session_id,
                                edn.kw(":canopy-base-height"), "clip.cbh_" + session_id,
                                edn.kw(":crown-bulk-density"), "clip.cbd_" + session_id,
                                edn.kw(":canopy-cover"), "clip.cc_" + session_id]),
                                    edn.kw(":srid"), "CUSTOM:900914",
                                    edn.kw(":cell-size"), 98.425,
                                    edn.kw(":ignition-row"), checkVals(ignitionLat), 
                                    edn.kw(":ignition-col"), checkVals(ignitionLon),
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
                                    edn.kw(":outfile-suffix"), "_" + session_id,
                                    edn.kw(":output-landfire-inputs?"), true,
                                    edn.kw(":output-geotiffs?"), true,
                                    edn.kw(":output-pngs?"), true,
                                    edn.kw(":output-csvs?"), true]);

        // Encode EDN Map
        var ednObj = edn.encode(ednMap);

        fs.writeFile('sample_params.edn', ednObj, function(err, ednObj) {
            if (err) console.log(err);
            console.log('\nWrote params to file sample_params.edn.\n');
        });

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
