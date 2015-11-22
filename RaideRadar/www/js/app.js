var stations        = [];
var selectedStation = {};

console.log(stations);

var app = angular.module('radar', ['ionic', 'ngResource', 'ngCordova']);

app.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if(window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }
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
          templateUrl: "templates/contact.html"
        }
      }
    });


   $urlRouterProvider.otherwise("/tab/home");

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
app.controller('MapCtrl', function($scope, $state, $cordovaGeolocation) {
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
           title: location.stationName
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
app.controller("ScheduleCtrl", ['$scope', '$http', 'Stations', 'StationHelper', function($scope, $http, Stations, StationHelper) {

  //$scope.stations = [];
  $scope.data = { "stations" : [], "search" : '', "isDestination" : false };
  var destinationEdited = false;
  var departureShortCode = " ";
  var destinationShortCode = " ";

  Stations.query(function(data) {
        
        for(value in data) {
            stations[value] = (data[value]);
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
  }

  $scope.editingStarted = function(station) {
  $scope.editingStopped = false;
   
  }

//kutsutaan kun hae junat-painiketta painetaan.
//tekee rajapintapyynnön asemien tunnuskoodien avulla
  $scope.searchForTrains = function(station) {

  $http.get('http://rata.digitraffic.fi/api/v1/schedules?departure_station='+ departureShortCode + '&arrival_station=' + destinationShortCode).success(function(data) {
    $scope.data.trains = data;
    console.log(data)
  });

   
  }


}]);