
// Layers for OpenLayers map
var layerConfigs = [
    {title: 'DigitalGlobeRecentImagery',
        extent: null,
        sourceConfig: {
            type: 'DigitalGlobe',
            imageryId: 'digitalglobe.nal0g75k',
            accessToken: 'pk.eyJ1IjoiZGlnaXRhbGdsb2JlIiwiYSI6ImNqM2RuZTE3dTAwMncyd3Bwanh4MHJ1cmgifQ.LNrR2h_I0kz6fra93XGP2g'
        }
    },
    {title: 'DigitalGlobeRecentImagery+Streets',
        extent: null,
        sourceConfig: {
            type: 'DigitalGlobe',
            imageryId: 'digitalglobe.nal0mpda',
            accessToken: 'pk.eyJ1IjoiZGlnaXRhbGdsb2JlIiwiYSI6ImNqM2RuZTE3dTAwMncyd3Bwanh4MHJ1cmgifQ.LNrR2h_I0kz6fra93XGP2g'
        }
}];

// Initialize OpenLayers map
var mapConfig = mercator.createMap('map', [-120.8958, 38.8375], 6, layerConfigs);

// View OpenLayers map 
var layerDigitalGlobe = 'DigitalGlobeRecentImagery';
var layerDigitalGlobeStreets = 'DigitalGlobeRecentImagery+Streets';

mercator.setVisibleLayer(mapConfig, layerDigitalGlobeStreets);

// Add overlay for form fields 
mercator.addOverlay(mapConfig, '#sampleFields');

// Enable dragbox interaction (lon-min, lat-min, lon-max, lat-max are the coordinate input fields)
var displayDragBoxBounds = function (dragBox) {
    var extent = dragBox.getGeometry().clone().transform("EPSG:3857", "EPSG:4326").getExtent();
    document.getElementById("lon-min").value = extent[0];
    document.getElementById("lat-min").value = extent[1];
    document.getElementById("lon-max").value = extent[2];
    document.getElementById("lat-max").value = extent[3];
};
mercator.enableDragBoxDraw(mapConfig, displayDragBoxBounds);

var onMapClick = function (e) {
    var currLoc = e.coordinate;

    var latDiv = document.getElementById('ignition-lat');
    var lonDiv = document.getElementById('ignition-lon');

    var newCoords = mercator.reprojectFromMap(currLoc[0], currLoc[1]);
    latDiv.value = newCoords[1];
    lonDiv.value = newCoords[0];
};
mapConfig.map.on('click', onMapClick);

proj4.defs('CUSTOM:900914', '+proj=aea +lat_1=29.5 +lat_2=45.5 +lat_0=23 +lon_0=-96 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs');
var proj900914 = ol.proj.get('CUSTOM:900914');

if (validSims) {
    validSims.forEach(
        function (sim) {

            console.log("\n\nAdding valid layer FlameLength_" + sim);
            console.log("sessionId: " + sessionId);
            console.log("extent: " + extent);

            // add .png to map 
            mapConfig.map.addLayer(new ol.layer.Image({
                title: 'FlameLength_' + sim,
                source: new ol.source.ImageStatic({
                    attributions: 'GridFire',
                    url: 'http://localhost:3000/model/flame_length_' + sessionId + '_' + sim + '.png',
                    projection: 'CUSTOM:900914',
                    imageExtent: extent
                })
            }));
        }
    );

    // Adding CSV to HTML table 
    CsvToHtmlTable.init({
        csv_path: 'model/summary_stats_' + sessionId + '.csv',
        //element: 'table-container',
        element: 'summaryStatsContainer',
        allow_download: true,
        csv_options: {separator: ',', delimiter: '"'},
        datatables_options: {"paging": false}
    });

    document.getElementById('summaryStatsContainer').style.display = "block";
}

/* 

*/

/**********************************************************

// TODO: Use LayerSwitcher widget, enable on map 

*********************************************************/

// LayerSwitcher widget (walkermatt's ol-layerswitcher)

//mapConfig.map.addLayer(new ol.Layer.OSM());

/*var layerSwitcher = new.ol.control.LayerSwitcher({
    tipLabel: 'Example label'
});
mapConfig.map.addControl(layerSwitcher);*/

