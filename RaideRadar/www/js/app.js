var stations          = [];
var selectedStation   = {};
var favorites         = [];
var tempDestShortCode = "";
var tempDepShortCode  = "";
var db                = null;

console.log(stations);

var app = angular.module('radar', ['ionic', 'ngResource', 'ngCordova']);

app.run(function($ionicPlatform, $cordovaSQLite) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if(window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }
    console.log($cordovaSQLite)
    db = $cordovaSQLite.openDB("favorites.db");
    $cordovaSQLite.execute(db, "CREATE TABLE IF NOT EXISTS favorites (id INTEGER PRIMARY KEY, fromStation VARCHAR, toStation VARCHAR, fromStationCode VARCHAR, toStationCode VARCHAR)");

  });
});


// Tab functionality
app.config(function($stateProvider, $urlRouterProvider) {

  $stateProvider
    .state('tabs', {
      url: "/tab",
      abstract: true,
      templateUrl: "templates/tabs.html"
    })
    .state('tabs.home', {
      url: "/home",
      views: {
        'home-tab': {
          templateUrl: "templates/home.html",
          controller: 'ScheduleCtrl'
        }
      }
    })
    .state('tabs.details', {
      url: "/details",
      views: {
        'home-tab': {
          templateUrl: "templates/details.html",
          controller: 'ScheduleCtrl'
        }
      }
    })
    .state('tabs.about', {
      url: "/about",
      views: {
        'about-tab': {
          templateUrl: "templates/about.html",
          controller: "MapCtrl"
        }
      }
    })
    .state('tabs.contact', {
      url: "/contact",
      views: {
        'contact-tab': {
          templateUrl: "templates/contact.html",
          controller: 'DBCtrl'
        }
      }
    });


   $urlRouterProvider.otherwise("/tab/home");

});

// Shares station data between ScheduleCtrl and DBCtrl
app.factory('sharedProperties', function ($rootScope) {
        var sharedService = {};

        sharedService.toStation       = "";
        sharedService.toStationCode   = "";
        sharedService.fromStation     = "";
        sharedService.fromStationCode = "";
/*
        return {
            getStationObject: function () {
                return stationObject;
            },
            setStationObject: function(toStation, toStationCode, fromStation, fromStationCode) {
                stationObject = { "toStation": toStation, "toStationCode": toStationCode,
                "fromStation": fromStation, "fromStationCode": fromStationCode };
            }
        };
*/
        sharedService.prepForBroadcast = function(toStation, toStationCode, fromStation, fromStationCode) {
            this.toStation       = toStation;
            this.toStationCode   = toStationCode;
            this.fromStation     = fromStation;
            this.fromStationCode = fromStationCode;

            this.broadcastItem();
        };

        sharedService.broadcastItem = function() {
            $rootScope.$broadcast("handleBroadcast");
        };

        sharedService.broadcastMapReload = function() {
            $rootScope.$broadcast("handleReload");
        };

        return sharedService;
    });


//palauttaa olion kaikista asemista
app.factory("Stations", function($resource) {
    return $resource("http://rata.digitraffic.fi/api/v1/metadata/stations");
});


//filtteröi asemataulukkoa käyttäjän syötteen perusteella ja alustaa osumat matches muuttujaan
app.factory('StationHelper', function($q, $timeout) {

    var searchStations = function(searchFilter) {

        console.log('Searching stations for ' + searchFilter);

        var deferred = $q.defer();

      var matches = stations.filter( function(station) {
        if(station.stationName.toLowerCase().indexOf(searchFilter.toLowerCase()) !== -1 ) {
          console.log("found!")
          return true;
        }
      })

        $timeout( function(){

           deferred.resolve( matches );

        }, 0);

        return deferred.promise;

    };

    return {

        searchStations : searchStations

    }
})

// Map Controller
app.controller('MapCtrl', function($scope, $state, $cordovaGeolocation, sharedProperties) {
/*
  $scope.$on("handleReload", function() {
        $window.location.reload();
    });
*/
  var options = { timeout: 10000, enableHighAccuracy: true };

  $cordovaGeolocation.getCurrentPosition(options).then(function(position){

    var latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);

    var mapOptions = {
      center: latLng,
      zoom: 9,
      streetViewControl: false,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    $scope.map = new google.maps.Map(document.getElementById("map"), mapOptions);
     
    var markers = [];
    var image = {
      url: 'img/marker32.png'
    };

    // Add marker to every passanger traffic station
    for (var i = 0; i < stations.length; i++) {
      if (stations[i].passengerTraffic == true) {
        var location = stations[i];
        console.log(location);
        var latLng = new google.maps.LatLng(location.latitude,
            location.longitude);
        var marker = new google.maps.Marker({
           position: latLng,
           //map: map,
           draggable:false,
           title: location.stationName,
           icon: image
        });
        markers.push(marker);
        marker.setMap($scope.map);

        markerInfo(marker, stations[i].stationShortCode, stations[i].stationName);
      }
    }

  }, function(error){
    console.log("Could not get location");
  });
});

function markerInfo(marker, shortCode, stationName) {
  var infowindow = new google.maps.InfoWindow({
      disableAutoPan: false,
      content: "<div id='markerContent'>  </div>"
  });

//http://rata.digitraffic.fi/api/v1/live-trains?station=HKI
  marker.addListener('click', function() {
    console.log("Asema lyhenne " + shortCode);
    infowindow.close();
    getStation(marker, shortCode, stationName);
    infowindow.open(marker.get('map'), marker);
    //infowindow.setContent();
  });
}

// Get stations and pass the info to the selected marker
function getStation(marker, shortCode, stationName) {
    var xmlHttp = new XMLHttpRequest();

    xmlHttp.onreadystatechange = function() {
      if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
        var responseData = JSON.parse(xmlHttp.responseText);
        selectedStation = responseData;
        //console.log(responseData);
        //console.log(responseData[0]);
        setInfoMarkerText(shortCode, stationName);
    }

    xmlHttp.open("GET",
      "http://rata.digitraffic.fi/api/v1/live-trains?station=" +
      shortCode + "&arrived_trains=5&arriving_trains=5&departed_trains=5&departing_trains=5",
      true);
    xmlHttp.send(null);
}

// Parse station data and display the information
function setInfoMarkerText(shortCode, stationName) {
  var outputHTML = "";
  var outputArr  = [];
  

  console.log("asemien määrä " + selectedStation.length);

  // Iterate through all the trains going through the selected station
  // The outer loop iterates through trains and the inner loop iterates through the stations
  // that are on the trains path
  for (var train = 0; train < selectedStation.length; train++) {
      if (selectedStation[train].trainCategory == "Long-distance" ||
          selectedStation[train].trainCategory == "Commuter" ) {
          var temp = "";
          temp    += "<table class='pure-table'><caption><b>" + selectedStation[train].trainType + " " +
                                      selectedStation[train].trainNumber + "<b></caption>" +
                 "<thead><tr><th>Saapumis Aika</th><th>Lähtö Aika</th></tr></thead><tbody>"
          if (typeof selectedStation[train] != 'undefined' || selectedStation[train] != null) {
            for (var station = 0; station < selectedStation[train].timeTableRows.length; station++) {
                if (selectedStation[train].timeTableRows[station].stationShortCode == shortCode) {
                  var depTime;
                  var arrTime;
                  console.log("juna " + selectedStation[train].trainNumber + " - " + selectedStation[train].timeTableRows[station].type);
                  if (selectedStation[train].timeTableRows[station].type == "ARRIVAL") {

                      temp += "<tr>";
                      var time  = new Date(selectedStation[train].timeTableRows[station].scheduledTime);
                      arrTime   = time;
                      var hours = time.getHours().toString().length   == 1
                          ? "0" + time.getHours().toString()   : time.getHours();
                      var mins  = time.getMinutes().toString().length == 1
                          ? "0" + time.getMinutes().toString() : time.getMinutes();
                      temp += "<td>" + hours + ":"  + mins + "</td>";
                  }

                  temp += station == 0 ? "<tr><td>Lähtöasema</td>" : "";

                  temp += selectedStation[train].timeTableRows.length-1 == station ? "<td>Pääteasema</td></tr>" : "";

                  if (selectedStation[train].timeTableRows[station].type == "DEPARTURE") {
                      outputArr.splice(outputArr.length-1, 1);
                      var time  = new Date(selectedStation[train].timeTableRows[station].scheduledTime);
                      depTime   = time;
                      var hours = time.getHours().toString().length   == 1
                          ? "0" + time.getHours().toString()   : time.getHours();
                      var mins  = time.getMinutes().toString().length == 1
                          ? "0" + time.getMinutes().toString() : time.getMinutes();
                      temp += "<td>" + hours + ":"  + mins + "</td>";
                      temp += "</tr>";
                  }

                  var time = arrTime == 'undefined' ? depTime : arrTime;
                  outputArr.push({"time": time, "tableRow": temp});

               }
            }
          }
      }
  }
  console.log("enne - " + outputArr);
  outputArr.sort(sortOutput);
  console.log("jälke - " + outputArr);
  for (var i = 0; i < outputArr.length; i++) {
    outputHTML += outputArr[i].tableRow;
    console.log(outputArr[i].time);
  }

  outputHTML += "</tbody><br>";
  document.getElementById("markerContent").innerHTML = "<h4>" + stationName + "</h4>" + "<br>" + outputHTML;
}

function sortOutput(a, b) {
  if (a.time > b.time) {
    return 1;
  }
  if (a.time < b.time) {
    return -1;
  }
  return 0;
}

// Schedule Controller
app.controller("ScheduleCtrl", ['$scope', '$http', '$q', 'Stations', 'StationHelper', 'sharedProperties', function($scope, $http, $q, Stations, StationHelper, sharedProperties) {
/*
  $scope.$on('$ionicView.beforeLeave', function(){
    sharedProperties.broadcastMapReload();
  });
*/
  //$scope.stations = [];
  $scope.data = { "stations" : [], "search" : '', "isDestination" : false };
  var destinationEdited = false;
  var departureShortCode = " ";
  var destinationShortCode = " ";


    console.log(document)

    console.log("scope: documetn! " + $scope.document)


  Stations.query(function(data) {

        for(var i = 0; i<data.length; i = i +1) {
            stations[i] = (data[i]);
        }

        console.log($scope.stations);
    });

//etsii asemia käyttäjän syötteen perusteella lähtöasema-tekstikenttään
  $scope.searchDeparture = function() {

  StationHelper.searchStations($scope.data.departure).then(
    function(matches) {
      $scope.data.stations = matches;
      destinationEdited = false;
      console.log(matches[0].stationName)
    }
   )
  }

//etsii asemia käyttäjän syötteen perusteella määränpää-tekstikenttään
  $scope.searchDestination = function() {

    StationHelper.searchStations($scope.data.destination).then(
      function(matches) {
        $scope.data.stations = matches;
        destinationEdited = true;
        console.log(matches[0].stationName)
      }
    )
  }

  $scope.trainClicked = function(train) {

    console.log(train);
    console.log(document)
    console.log(document.getElementById("route"))

// odottaa että tabin html-template on latautunut,
// jonka jälkeen asettaa junan tiedot html-tiedostoon
    function waitForTabLoading() {
      if(document.getElementById("timeInfo")==null) {//we want it to match
        setTimeout(waitForTabLoading, 50);//wait 50 millisecnds then recheck
        return;
    }


    console.log("swag:" + destinationShortCode);
    var detailHTML = '<div class="row">'
    for(var i = 0; i < train.timeTableRows.length; i = i + 1) {

      if(train.timeTableRows[i].stationShortCode == departureShortCode && train.timeTableRows[i].type =="DEPARTURE") {
        console.log("lähtöaika: " + train.timeTableRows[i].scheduledTime)

        detailHTML = detailHTML + '<div class="col"><h3 align="center">Lähtöaika: </h3><h1 align="center">' + formatDateToString(train.timeTableRows[i].scheduledTime) + '</h1></div>';

      } else if (train.timeTableRows[i].stationShortCode == destinationShortCode && train.timeTableRows[i].type =="ARRIVAL") {


        detailHTML = detailHTML + '<div class="col"><h3 align="center">Saapumisaika: </h3><h1 align="center">' + formatDateToString(train.timeTableRows[i].scheduledTime) + '</h1></div>';

   }



   if(train.runningCurrently) {
    document.getElementById("isOnRoute").innerHTML = "<h3 align='center'>Juna on liikkeellä</h3>"
   } else {
    document.getElementById("isOnRoute").innerHTML = "<h3 align='center'>Juna ei ole liikkeellä</h3>"
   }

  }

  var compPromise = getTrainComposition(train);

  compPromise.then(function(result) {

    setWagonData(result, setWagonImages)
  });


  document.getElementById("timeInfo").innerHTML = detailHTML + '</div>'

  }

  waitForTabLoading();

}

getTrainComposition = function(train) {

  var temp = {};
    var defer = $q.defer();
    $http.get('http://rata.digitraffic.fi/api/v1/compositions/' + train.trainNumber + '?departure_date=' + train.departureDate).success(function(data){
            temp =data;
            defer.resolve(data);

    });
    return defer.promise;
}

setWagonData = function(data, callback) {

  var wagonCount = 0;
  var wagonHTML = '';
  var forcount = 0;
  if(data.journeySections != null) {
  console.log("lenght :" + data.journeySections.length);
    for(var i = 0; i<data.journeySections.length; i = i + 1) {

      if(data.journeySections[i].beginTimeTableRow.stationShortCode == departureShortCode) {

          if(data.journeySections[i].wagons != null) {
            wagonCount = data.journeySections[i].wagons.length
            console.log("vaunuja oikeessa mestassa: " + data.journeySections[i].wagons.length);
          }

          forcount += 1

          console.log("forcoutn: " + forcount)

      } else if(data.journeySections[i].wagons != null) {
          console.log("vaunumäärä" + data.journeySections[i].beginTimeTableRow.stationShortCode + "ssä: " + data.journeySections[i].wagons.length)
          if(wagonCount == 0) {

           wagonCount = data.journeySections[i].wagons.length
          }
          forcount += 1
          console.log("forcoutn: " + forcount)
      }

      if(i == data.journeySections.length-1) {
          console.log("let's call callback!")
          callback(wagonCount);

      }
    }
  }
}



setWagonImages = function(wagonCount) {

  if(wagonCount != 0) {

  wagonHTML = '<div align="center"><h3>Vaunuja junassa: ' + wagonCount + '</div><div class="row">'


    for(var j = 0;j<wagonCount;j = j + 1) {
      if(j == wagonCount-1) {
        wagonHTML += '<div class="col" id="trainimg"><img src="img/train.png" width="100%" alt="train"></img></div></div>'
        document.getElementById("wagonInfo").innerHTML = wagonHTML
      } else {
         console.log("we here" + j)
        wagonHTML += '<div class="col" id="trainimg"><img src="img/wagon.png" width="100%" alt="wagon"></img></div>'
      }
    }

  } else {
    document.getElementById("wagonInfo").innerHTML = '<div align="center"><h3>Vaunutietoja ei saatavilla</h3>'
  }
}




//kutsutaan kun käyttäjä valitsee aseman listasta
  $scope.stationItemClicked = function(station) {

  //valittu asema tekstikenttään
    console.log(destinationEdited);
    if(destinationEdited) {

      //jos määränpää-tekstikenttää muokattiin
      $scope.data.destination = station.stationName;
      // alustetaan valitun aseman tunnuskoodi muita rajapintapyyntöjä varten
      destinationShortCode = station.stationShortCode;
    } else {

      //jos lähtöasema-tekstikenttää muokattiin
      $scope.data.departure = station.stationName;
      // alustetaan valitun aseman tunnuskoodi muita rajapintapyyntöjä varten
      departureShortCode = station.stationShortCode;
    }
    //lopetetaan editointi, jolloin lista asemista katoaa
    $scope.editingStopped = true;
    console.log("departurecode: " + departureShortCode);
    console.log("destinationcode: " + destinationShortCode);
    tempDepShortCode  = departureShortCode;
    tempDestShortCode = destinationShortCode; 
  }

  $scope.editingStarted = function(station) {
    $scope.editingStopped = false;


  }

  $scope.addToFavorites = function() {
      sharedProperties.prepForBroadcast($scope.data.departure, 
        tempDepShortCode, $scope.data.destination, tempDestShortCode);  
  }

//kutsutaan kun hae junat-painiketta painetaan.
//tekee rajapintapyynnön asemien tunnuskoodien avulla
  $scope.searchForTrains = function(station) {

  $scope.showFavoriteButton = true;

  $http.get('http://rata.digitraffic.fi/api/v1/schedules?departure_station='+ departureShortCode + '&arrival_station=' + destinationShortCode + '&limit=8').success(function(data) {
    $scope.data.trains = data;
    console.log(data)

    for(var j = 0;j<$scope.data.trains.length;j = j +1) {


      for(var i = 0; i < $scope.data.trains[j].timeTableRows.length; i = i + 1) {
        if($scope.data.trains[j].timeTableRows[i].stationShortCode == departureShortCode && $scope.data.trains[j].timeTableRows[i].type =="DEPARTURE") {
          console.log("lähtöaika: " + $scope.data.trains[j].timeTableRows[i].scheduledTime)

          $scope.data.trains[j].depTime = formatDateToString($scope.data.trains[j].timeTableRows[i].scheduledTime);

        } else if ($scope.data.trains[j].timeTableRows[i].stationShortCode == destinationShortCode && $scope.data.trains[j].timeTableRows[i].type =="ARRIVAL") {

          $scope.data.trains[j].desTime = formatDateToString($scope.data.trains[j].timeTableRows[i].scheduledTime);
        }
      }
    }

    if($scope.data.trains != null) {
      trainsFound = true;
      console.log("flalflöfalöaflöfalöföafffafa");
    }

  });
  }


}]);

app.controller("DBCtrl", ['$scope', '$cordovaSQLite', 'sharedProperties', function($scope, $cordovaSQLite, sharedProperties) {
    //var objToInsert = sharedProperties.getProperty();
    var objToInsert = {};
    $scope.favArray = [];

    $scope.$on("handleBroadcast", function() {
        objToInsert = {"toStation":       sharedProperties.toStation, 
                       "toStationCode":   sharedProperties.toStationCode,
                       "fromStation":     sharedProperties.fromStation, 
                       "fromStationCode": sharedProperties.fromStationCode};
        insert();
    });

    selectAllFromTable();   

    function insert() {
        var query = "INSERT INTO favorites (toStation, toStationCode, fromStation, fromStationCode) VALUES (?,?,?,?)";
        $cordovaSQLite.execute(db, query, [objToInsert.toStation, objToInsert.toStationCode,
          objToInsert.fromStation, objToInsert.fromStationCode]).then(function(res) {
            console.log("INSERT ID -> " + res.insertId);

          $scope.favoriteClick = true;
        }, function (err) {
            alert(err);
            console.error(err);
        });
    }

    $scope.insert = function() {

      console.log(sharedProperties.getProperty());


    }

    $scope.select = function() {

    }

    $scope.delete = function(favorite) {
        console.log("delete  = " + favorite.id);
        var query = "DELETE FROM favorites WHERE id = ?";
        $cordovaSQLite.execute(db, query, [favorite.id]).then(function(res) {
            console.log("deleted");
            selectAllFromTable();
        }, function (err) {
            console.error(err);
        });
    }

    function selectAllFromTable() {
        $scope.favArray = [];
        var query  = "SELECT * FROM favorites";
        $cordovaSQLite.execute(db, query, []).then(function(res) {
            if(res.rows.length > 0) {
              // res.rows.item(0).toStation
              for (var i = 0; i < res.rows.length; i++) {
                console.log("db to " + res.rows.item(i).toStation, res.rows.item(i).toStationCode,
                  res.rows.item(i).fromStation, res.rows.item(i).fromStationCode);
                  $scope.favArray.push({"fromStation": res.rows.item(i).fromStation, 
                      "fromStationCode": res.rows.item(i).fromStationCode, "toStation": res.rows.item(i).toStation, 
                      "toStationCode": res.rows.item(i).toStationCode, "id": res.rows.item(i).id})
              }
            } else {
                console.log("No results found");
            }
        }, function (err) {
            console.error(err);
        });
    }
}]);

function formatDateToString(date) {
    var d = new Date(date);
    var hours = '';
    var minutes = ''

    if(d.getHours()<10) {
      hours = '0' + d.getHours().toString();
    } else {
      hours = d.getHours().toString();
    }

    if(d.getMinutes()<10) {
      minutes = '0' + d.getMinutes().toString();
    } else {
      minutes = d.getMinutes().toString();
    }

    var time = hours + ':' + minutes;

    return time;

}
