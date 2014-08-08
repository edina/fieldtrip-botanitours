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

/* global L, _ */

define(['map', 'utils', './leaflet.geometryutil'], function(map, utils, geomUtils){
    var db;
    var currentRecordsExtent;
    var pois;
    var lastFetch;

    var filter = {
        type: 'None',
        text: '',
        subtype: ''
    };

    /**
     * Execute sql and show results as markers.
     * @param sql The sql select statement.
     * @param pan Should map pan to closest record?
     */
    var showRecordsBySQL = function(sql, pan){
        console.debug(sql);

        if(db === undefined){
            return;
        }

        db.executeSql(
            sql,
            [],
            function(results){
                var markerClick = function(e){
                    getPoiDescription(e.target.data, function(html){
                        e.target.bindPopup(html).openPopup();
                    });
                };

                pois = map.createMarkerLayer();
                console.debug(results.length + " results returned");
                for(var i = 0; i < results.length; i++){
                    var id = results[i][0];
                    var point = JSON.parse(results[i][1]);
                    var type = results[i][2];
                    var year = results[i][3];
                    var className = 'marker-icon';
                    if(type === 'Garden'){
                        className = 'marker-icon-red';
                    }

                    var marker = map.addMarker(
                        {
                            lon: point.coordinates[0],
                            lat: point.coordinates[1]
                        },
                        L.divIcon({
                            className: className,
                            iconSize: [40, 40]
                        }),
                        pois
                    );

                    marker.on('click', markerClick);
                    marker.data = {
                        'id': id,
                        'type': type,
                        'year': year
                    };
                }

                if(results.length > 0){
                    map.addLayer(pois);

                    if(pan){
                        // pan to nearest result
                        panToClosest(pois.getLayers());
                    }
                }
                else{
                    utils.inform("No results found.");
                }
            },
            function(error){
                console.error(error);
            }
        );
    };

    /**
     * Select poi filter.
     */
    var filterPoi = function(){
        $('#poi-filter-popup').popup('open');

        var highlightEntry = function(){
            var id = 'poi-filter-' + filter.type;

            $('#poi-filter-popup li').removeClass('ui-btn-active');
            $('#' + id).addClass('ui-btn-active');
            $('#poi-text-filter-plants').hide();
            $('#poi-filter-text').show();

            if(id === 'poi-filter-Plant'){
                $('#poi-text-filter-plants').show();
            }
            else if(id === 'poi-filter-None'){
                $('#poi-filter-text').hide();
            }
            else{
                $('#poi-text-filter-plants').hide();
            }
        };

        $('#poi-filter-popup li').off('vclick');
        $('#poi-filter-popup li').on('vclick', function(e){
            var id = $(e.target).closest('li').attr('id');
            filter.type = id.substr(id.lastIndexOf('-') + 1);
            highlightEntry();
        });

        $("input[name='poi-filter-Plant-type']").change('click', function(e){
            filter.subtype = $(this).val();
        });

        $('#poi-filter-popup-ok').off('click');
        $('#poi-filter-popup-ok').on('click', function(e){
            filter.text = $('#poi-filter-text').val().trim();
            $('#poi-filter-popup').popup('close');
            redrawPoi(true);
        });

        $('#poi-filter-popup-clear').off('click');
        $('#poi-filter-popup-clear').on('click', function(e){
            $('#poi-filter-text').val('');
        });

        highlightEntry();
    };

    /**
     * Get common names of a given plant.
     * @param id - plant id
     * @param callback Function executed on successful fetch.
     */
    var getPlantCommonNames = function(id, callback){
        var sql = "SELECT c.name FROM plants p, plant_common_names c WHERE p.OGC_FID = c.plant_id AND p.OGC_FID = " + id;
        console.debug(sql);
        db.executeSql(
            sql,
            [],
            function(results){
                var names = '';
                $.each(results, function(i, name){
                    if(i !== 0){
                        names += ', ';
                    }
                    names += name[0];
                });
                callback(names);
            },
            function(error){
                console.error(error);
            }
        );
    };

    /**
     * Get plant/garden name.
     * @param data associated with point
     *   id - The marker id.
     *   type - Marker type - plant of garden.
     *   year - year of observation.
     * @param callback Function executed on successful fetch.
     */
    var getPoiDescription = function(data, callback){
        var sql;
        var id = data.id;
        var type = data.type;

        if(type === 'Plant'){
            sql = "SELECT scientific_name, eol_image FROM plants WHERE OGC_FID = " + id;
        }
        else{
            sql = "SELECT name, opening_times_txt FROM gardens WHERE OGC_FID = " + id;
        }
        console.debug(sql);
        db.executeSql(
            sql,
            [],
            function(results){
                var entry = results[0];
                if(type === 'Plant'){
                    var year = data.year;
                    var image = entry[1];
                    getPlantCommonNames(id, function(names){
                        var html = '<div id="poi-popup"><h1>' + entry[0] + '</h1><img src="' + image + '" alt="jings"><p><strong>Common names</strong>: ' + names + '</p><p><strong>Year of observation</strong>: ' + year + '</p></div>';
                        callback(html);
                    });
                }
                else{
                    var html = '<div><h1>' + entry[0] + '</h1><p><strong>Opening Times:</strong>: ' + entry[1] + '</div>';
                    callback(html);
                }
            },
            function(error){
                console.error(error);
            }
        );
    };

    /**
     * Pan map to closest record in layers array.
     * @param layers Leaflet {array}
     */
    var panToClosest = function(layers){
        var lmap = map.getMap();
        var res = geomUtils.closestLayer(
            lmap,
            layers,
            map.getCentre()
        );
        lmap.panTo(res.latlng);
    };

    /**
     * Should records be redrawn?
     */
    var isRefreshRequired = function(){
        var isRequired = true;
        if(currentRecordsExtent){
            isRequired = !currentRecordsExtent.contains(map.getExtent());
        }

        return isRequired;
    };

    /**
     * Redraw points of interest.
     * @param pan Should map be panned to closest record?
     */
    var redrawPoi = function(pan){
        // Get cached cluster name, based on zoom level and filter.
        var zoomLevel = map.getZoom();
        var clusterName;

        if(filter.type !== 'None' && filter.text.length > 0){
            // filter by text only applies to plants and gardens not both
            showRecordsByFilter();
        }
        else{
            if(filter.type === 'Garden'){
                // there is a single cached json file for gardens
                clusterName = 'Gardens.json';
            }
            else{
                if(clusters[zoomLevel]){
                    clusterName = 'cluster' + clusters[zoomLevel] + '.json';
                }

                if(clusterName && filter.type === 'Plant'){
                    clusterName = filter.type + clusterName;
                }
            }

            console.debug("zoom: " + zoomLevel + " : " + clusterName);
            if(clusterName){
                showRecords(clusterName, pan);
            }
            else{
                showRecordsFromDB(pan);
            }
        }
    };

    /**
     * Show static cluster geojson records on map.
     * @param clusterName
     */
    var showRecords = function(clusterName, pan){
        if(lastFetch !== clusterName){
            if(pois){
                map.removeLayer(pois);
            }

            $.getJSON('data/' + clusterName, $.proxy(function(data){
                lastFetch = clusterName;
                pois = map.addGeoJSONLayer(
                    data,
                    function(feature){
                        // called for each icon add to the layer
                        var html = '';
                        var className = 'marker-icon';
                        var props = feature.properties;
                        if(props.count > 1){
                            className = 'cluster-icon';
                            html = '<div class="cluster-icon-text">' + feature.properties.count + '</div>';
                        }
                        else if(props.type === 'Garden'){
                            className = 'marker-icon-red';
                        }

                        var icon = L.divIcon({
                            className: className,
                            html: html,
                            iconSize: [40, 40]
                        });

                        return icon;
                    },
                    function(feature, layer){
                        // executed when feature is clicked
                        var coords = feature.geometry.coordinates;

                        if(feature.properties.count === 1 || feature.properties.type === 'Garden'){
                            // find point info
                            getPoiDescription(feature.properties, function(html){
                                layer.bindPopup(html).openPopup();
                            });
                        }
                        else{
                            // just centre map
                            map.setCentre({
                                lon: coords[0],
                                lat: coords[1],
                                zoom: map.getZoom() + 2
                            });
                        }
                    }
                );

                if(pan){
                    panToClosest(pois.getLayers());
                }
            }, this));
        }
    };

    /**
     * Show records from database on map based on filter text.
     */
    var showRecordsByFilter = function(){
        if(utils.compare(lastFetch, filter)){
            return;
        }
        else{
            if(pois){
                map.removeLayer(pois);
            }
            var sql;
            var table;
            var joinField = 'OGC_FID';
            var filterField = 'name';

            if(filter.type === 'Plant'){
                if(filter.subtype === 'common'){
                    table = 'plant_common_names';
                    joinField = 'plant_id';
                }
                else{
                    table = 'plants';
                    filterField = 'scientific_name';
                }

            }
            else if(filter.type === 'Garden'){
                table = 'gardens';
            }

            // save cloned filter as last fetch
            lastFetch = utils.clone(filter);

            sql = "SELECT DISTINCT i.positionable_id, AsGeoJSON(i.geometry), i.positionable_type, i.year FROM position_infos i, {0} t WHERE LOWER(t.{1}) LIKE LOWER('%{2}%') AND t.{3} = i.positionable_id AND positionable_type = '{4}'".format(
                table, filterField, filter.text, joinField, filter.type);

            showRecordsBySQL(sql, true);
        }
    };

    /**
     * Show records from database on map based on map extent.
     * @param pan Should map be panned to closest record?
     */
    var showRecordsFromDB = function(pan){
        var extent = map.getExtent();

        var ne = extent.getNorthEast();
        var sw = extent.getSouthWest();

        if(pois){
            map.removeLayer(pois);
        }

        // increase area to reduce the need for database fetches
        var buflat = (ne.lat - sw.lat) * 0.5;
        var buflon = (sw.lng - ne.lng) * 0.5;
        ne.lat = ne.lat + buflat;
        ne.lng = ne.lng - buflon;
        sw.lat = sw.lat - buflat;
        sw.lng = sw.lng + buflon;

        // remember bounds of last query
        currentRecordsExtent = map.createBounds(sw, ne);
        lastFetch = undefined;

        var sql = 'SELECT positionable_id, AsGeoJSON(geometry), positionable_type, year FROM position_infos WHERE ST_Within(geometry, BuildMbr(' + ne.lng + ',' + ne.lat + ',' + sw.lng + ',' + sw.lat + '))';

        if(filter.type !== 'None'){
            sql += " AND positionable_type = '" + filter.type + "'";
        }

        showRecordsBySQL(sql, pan);
    };

    /**
     * Map pan.
     */
    var lastCachedZoomLevel = 0;
    map.registerPan(function(){
        var zoomLevel = map.getZoom();
        if(filter !== 'Gardens' && zoomLevel > lastCachedZoomLevel){
            if(!isRefreshRequired()){
                console.debug("No refresh required.");
                return;
            }

            showRecordsFromDB(false);
        }
    }, this);

    /**
     * Map zoom.
     */
    map.registerZoom(function(){
        redrawPoi(false);
    }, this);

    // edinburgh
    //var p = [-3.162, 55.944];

    // dumfries
    var p = [-3.607, 55.072];

    map.setDefaultLonLat(p[0], p[1]);

    var clusters;
    require(['config'], function(config){
        clusters = JSON.parse(config.clusters);
        // flatten any ranges (so 0-3 become 1,2,3)
        $.each(clusters, function(i, cluster){
            var startEnd = i.split('-');
            if(startEnd.length > 1){
                var range = _.range(parseInt(startEnd[0]), parseInt(startEnd[1]) + 1);
                $.each(range, function(j, index){
                    clusters[index] = cluster;
                    lastCachedZoomLevel = Math.max(lastCachedZoomLevel, parseInt(index));
                });
            }

            lastCachedZoomLevel = Math.max(lastCachedZoomLevel, parseInt(startEnd));
        });
    });


    $(document).on('vclick', '#filter-poi', filterPoi);

    // close popup on click
    $(document).on('vclick', '.leaflet-popup', function(){
        map.closePopup();
    });

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
