/*
Copyright (c) 2014, EDINA,
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or
   other materials provided with the distribution.
3. All advertising materials mentioning features or use of this software must
   display the following acknowledgement: This product includes software
   developed by the EDINA.
4. Neither the name of the EDINA nor the names of its contributors may be used to
   endorse or promote products derived from this software without specific prior
   written permission.

THIS SOFTWARE IS PROVIDED BY EDINA ''AS IS'' AND ANY EXPRESS OR IMPLIED
WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
SHALL EDINA BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.
*/

"use strict";

define(['map', 'utils'], function(map, utils){
    var db;
    var currentRecordsExtent;
    var recordsLayer;

    /**
     * Get plant/garden name.
     * @param id The marker id.
     * @param type Markert type - plant of garden.
     * @param callback Function executed on successful fetch.
     */
    var getRecordDescription = function(id, type, callback){
        var sql;
        if(type === 'Plant'){
            sql = "SELECT scientific_name FROM plants WHERE OGC_FID = " + id;
        }
        else{
            sql = "SELECT name FROM gardens WHERE OGC_FID = " + id;
        }
        console.debug(sql);
        db.executeSql(
            sql,
            [],
            function(results){
                callback(results[0][0]);
            },
            function(error){
                console.error(error);
            }
        );
    };

    /**
     * Show static cluster records on map.
     * @param clusterName
     */
    var showRecords = function(clusterName){
        $.getJSON('data/' + clusterName, $.proxy(function(data){
            recordsLayer = map.addGeoJSONLayer(data);
        }, this));
    };

    /**
     * Show records from database on map based on map extent.
     */
    var showRecordsFromDB = function(){
        var extent = map.getExtent();

        var ne = extent.getNorthEast();
        var sw = extent.getSouthWest();

        // increase area to reduce the need for database fetches
        var buflat = (ne.lat - sw.lat) * 0.5;
        var buflon = (sw.lng - ne.lng) * 0.5;
        ne.lat = ne.lat + buflat;
        ne.lng = ne.lng - buflon;
        sw.lat = sw.lat - buflat;
        sw.lng = sw.lng + buflon;

        // remember bounds of last query
        currentRecordsExtent = map.createBounds(sw, ne);

        var sql = 'SELECT positionable_id, AsGeoJSON(geometry), positionable_type FROM position_infos WHERE ST_Within(geometry, BuildMbr(' + ne.lng + ',' + ne.lat + ',' + sw.lng + ',' + sw.lat + '))';
        console.debug(sql);

        if(db === undefined){
            return;
        }

        db.executeSql(
            sql,
            [ne.lng, ne.lat, sw.lng, sw.lat],
            function(results) {
                var markerClick = function(e){
                    var data = e.target.data;
                    getRecordDescription(data.id, data.type, function(name){
                        e.target.bindPopup(name).openPopup();
                    });
                };

                recordsLayer = map.createMarkerLayer();
                for(var i = 0; i < results.length; i++){
                    var id = results[i][0];
                    var point = JSON.parse(results[i][1]);
                    var type = results[i][2];

                    var marker = map.addMarker(
                        {
                            lon: point.coordinates[0],
                            lat: point.coordinates[1]
                        },
                        id,
                        recordsLayer
                    );

                    marker.on('click', markerClick);
                    marker.data = {
                        'id': id,
                        'type': type
                    };
                }

                map.addLayer(recordsLayer);
            },
            function(error){
                console.error(error);
            }
        );
    };

    /**
     * Show records be redrawn?.
     */
    var isRefreshRequired = function(){
        var isRequired = true;
        if(currentRecordsExtent){
            isRequired = !currentRecordsExtent.contains(map.getExtent());
        }

        return isRequired;
    };

    /**
     * Map pan.
     */
    map.registerPan(function(){
        var zoomLevel = map.getZoom();
        if(zoomLevel > 14){
            if(!isRefreshRequired()){
                console.debug("No refresh required.");
                return;
            }

            showRecordsFromDB();
        }
    }, this);

    /**
     * Map zoom.
     */
    map.registerZoom(function(e){
        var zoomLevel = map.getZoom();
        var clusterName;
        if(zoomLevel < 7){
            clusterName = 'cluster1.json';
        }
        else if(zoomLevel < 9){
            clusterName = 'cluster10.json';
        }
        else if(zoomLevel < 11){
            clusterName = 'cluster20.json';
        }
        else if(zoomLevel < 13){
            clusterName = 'cluster50.json';
        }
        else if(zoomLevel < 15){
            clusterName = 'cluster100.json';
        }

        if(recordsLayer){
            map.removeLayer(recordsLayer);
        }

        console.debug("zoom: " + zoomLevel + " : " + clusterName);

        if(clusterName){
            showRecords(clusterName);
        }
        else{
            showRecordsFromDB();
        }
    }, this);

    map.setDefaultLonLat(-3.1627, 55.9464);
    if(!utils.isMobileDevice()){
        return;
    }

    window.SpatiaLitePlugin.openDatabase(
        'botanitours',
        function(database){
            db = database;
            db.info(function(msg){
                console.debug(msg);
            });
        },
        function(e){
            console.error("Something went wrong with database: " + e);
        }
    );
});
