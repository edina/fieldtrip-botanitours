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
    var currentRecordsExtent;
    var recordsLayer;

    /**
     * Show records on map.
     * @param clusterName
     */
    var showRecords = function(clusterName){
        if(recordsLayer){
            map.removeLayer(recordsLayer);
        }

        $.getJSON('data/' + clusterName, $.proxy(function(data){
            recordsLayer = map.addGeoJSONLayer(data);
        }, this));
    };

    var isRefreshRequired = function(){
        var isRequired = true;
        if(currentRecordsExtent){
            // var zoomLevel = map.getZoom();

            // if(zoomLevel < 15){
            //     if(){
            // }
            // else if typeof(currentRecordsExtent) === 'Number'{
            //     return true
            // }
            // else{
            //     return currentRecordsExtent.contains(map.getExtent());
            // }
            return currentRecordsExtent.contains(map.getExtent());
        }

        return isRequired;
    };

    map.registerReady(this, function(){
        showRecords('cluster10.json');
    });

    map.registerPan(this, function(){
        //console.log("***********");
    });

    map.registerZoom(this, function(){
        var zoomLevel = map.getZoom();
        console.log("zoom : " + zoomLevel);
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
        else{
            map.removeLayer(recordsLayer);
        }
        showRecords(clusterName);
    });


    map.setDefaultLonLat(-3.12, 55.3);

    if(!utils.isMobileDevice()){
        return;
    }

    var db;
    window.SpatiaLitePlugin.openDatabase(
        'botanitours',
        function(database){

            db = database;
            db.info(function(msg){
                console.log(msg);
            });

            db.executeSql(
                'SELECT OGC_FID, ST_AsText(geometry) FROM position_infos WHERE ST_Within(geometry, BuildMbr(-2.4178, 55.8741, -2.2384, 55.8049))',
                [],
                function (results) {
                    for(var i in results){
                        if(parseInt(i) >= 0){
                            console.log(results[i][0] + " : " + results[i][1]);
                        }
                    }
                },
                function(error){
                    console.log(error);
                }
            );

            db.executeSql(
                'SELECT count(*) FROM position_infos WHERE ST_Within(geometry, BuildMbr(-2.4178, 55.8741, -2.2384, 55.8049))',
                [],
                function (results) {
                    console.log("rows: " + results[0][0]);
                },
                function(error){
                    console.log(error);
                }
            );
        },
        function(){
            console.log("Something went wrong with database.");
        }
    );
});
