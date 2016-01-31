var stations          = [];
var selectedStation   = {};
var favorites         = [];
var tempDestShortCode = "";
var tempDepShortCode  = "";
var tempDestination   = "";
var tempDeparture     = "";
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

    // Initialize the database
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
    .state('tabs.map', {
      url: "/map",
      views: {
        'map-tab': {
          templateUrl: "templates/map.html",
          controller: "MapCtrl"
        }
      }
    })
    .state('tabs.favorites', {
      url: "/favorites",
      views: {
        'favorites-tab': {
          templateUrl: "templates/favorites.html",
          controller: 'DBCtrl'
        }
      }
    });


   $urlRouterProvider.otherwise("/tab/home");

});

// Shares station data between ScheduleCtrl and DBCtrl
app.factory('sharedProperties', function ($rootScope) {
    var sharedService             = {};
    sharedService.toStation       = "";
    sharedService.toStationCode   = "";
    sharedService.fromStation     = "";
    sharedService.fromStationCode = "";
    sharedService.isFavorite      = false;

    sharedService.prepForBroadcast = function(fromStation, fromStationCode, toStation, toStationCode) {
        this.toStation       = toStation;
        this.toStationCode   = toStationCode;
        this.fromStation     = fromStation;
        this.fromStationCode = fromStationCode;
        this.broadcastItem();
    };

    sharedService.broadcastItem = function() {
        $rootScope.$broadcast("handleBroadcast");
    };

    return sharedService;
});


// Returns an object with an array of stations from the API
app.factory("Stations", function($resource) {
  return $resource("http://rata.digitraffic.fi/api/v1/metadata/stations");
});



// Returns a promise of function that filters the array of stations with the users input.
// This is used for autocompletion of users input in station textfields.
app.factory('StationHelper', function($q, $timeout) {

    var searchStations = function(searchFilter) {

        console.log('Searching stations for ' + searchFilter);

        var deferred = $q.defer();

      var matches = stations.filter( function(station) {
        if(station.stationName.toLowerCase().indexOf(searchFilter.toLowerCase()) !== -1 ) {
          //console.log("found!")
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
app.controller('MapCtrl', function($scope, $interval, $cordovaGeolocation, sharedProperties) {

  var options     = { timeout: 10000, enableHighAccuracy: true };

  // Get user location, If location cannot be retrieved, 
  // map is initialized with default position
  $cordovaGeolocation.getCurrentPosition(options).then(function(position){
    mapInit(true, position);
  }, function(error){
    console.log("Could not get location");
    mapInit(false, null);
  });

  // Initialize map location, settings and info markers
  function mapInit(locationFound, position) {
    var latLng;
    var mapOptions;

    if (locationFound) {
      latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
  
      mapOptions = {
        center: latLng,
        zoom: 9,
        streetViewControl: false,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      };
    } else {
      latLng = new google.maps.LatLng(61.8807983, 24.7636392);
  
      mapOptions = {
        center: latLng,
        zoom: 6,
        streetViewControl: false,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      };
    }

    $scope.map = new google.maps.Map(document.getElementById("map"), mapOptions);
     
    //var markers = [];
    var image = {
      url: 'img/marker32.png'
    };

    var infowindow = new google.maps.InfoWindow({
      disableAutoPan: false,
      content: "<div id='markerContent'>  </div>"
     });

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
        //markers.push(marker);
        marker.setMap($scope.map);

        markerInfo(marker, stations[i].stationShortCode, stations[i].stationName, infowindow);
      }
    }

    // Reload map to prevent it from being destroyed when other controllers are used
    $scope.$on('$stateChangeSuccess', function() {
      $interval(function() {
          //$scope.map.invalidateSize();
        google.maps.event.trigger($scope.map, 'resize');
      }, 500, 1);
    });
  }

});

// Set a click listener for the info marker
function markerInfo(marker, shortCode, stationName, infowindow) {

    marker.addListener('click', function() {
      console.log("Asema lyhenne " + shortCode);
      infowindow.close();
      getStation(marker, shortCode, stationName);
      infowindow.open(marker.get('map'), marker);
      marker.get('map').setCenter(marker.getPosition());
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
  // that are on the train's path
  for (var train = 0; train < selectedStation.length; train++) {
      if (selectedStation[train].trainCategory == "Long-distance" ||
          selectedStation[train].trainCategory == "Commuter" ) {
          var temp = "";
          temp += "<table class='pure-table'><b><text-e id='train-name'>" + selectedStation[train].trainType + " " +
        selectedStation[train].trainNumber + "</text-e></b><b><text-e id='route'> " + selectedStation[train].timeTableRows[0].stationShortCode + "-" +
        selectedStation[train].timeTableRows[selectedStation[train].timeTableRows.length - 1].stationShortCode + "</text-e></b><thead><tr><th>Saapumis Aika</th><th>Lähtö Aika</th></tr></thead><tbody>";

          if (typeof selectedStation[train] != 'undefined' || selectedStation[train] != null) {
            for (var station = 0; station < selectedStation[train].timeTableRows.length; station++) {
                if (selectedStation[train].timeTableRows[station].stationShortCode == shortCode) {
                  var depTime;
                  var arrTime;
                  console.log("juna " + selectedStation[train].trainNumber + " - " + selectedStation[train].timeTableRows[station].type);

                  // Arrival
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

                  // First stop
                  temp += station == 0 ? "<tr><td>Lähtöasema</td>" : "";

                  // Last stop
                  temp += selectedStation[train].timeTableRows.length-1 == station ? "<td>Pääteasema</td></tr>" : "";

                  // Departure
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

  outputArr.sort(sortOutput);

  for (var i = 0; i < outputArr.length; i++) {
    outputHTML += outputArr[i].tableRow;
    console.log(outputArr[i].time);
  }

  outputHTML += "</tbody><br>";
  document.getElementById("markerContent").innerHTML = "<h4>" + stationName + "</h4>" + "<br>" + outputHTML;
}

// Sort an array by time
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
app.controller("ScheduleCtrl", ['$scope', '$http', '$q', 'Stations', 'StationHelper', 'sharedProperties', '$ionicPopup', function($scope, $http, $q, Stations, StationHelper, sharedProperties, $ionicPopup) {
  
  $scope.addedToFavorites = false;
  $scope.loading = false;

  $scope.data = { "stations" : [], "search" : '', "isDestination" : false };
  var destinationEdited = false;
  var departureShortCode = " ";
  var destinationShortCode = " ";


    console.log(document)

    console.log("scope: documetn! " + $scope.document)


  //Call Stations factory and create and array of stations from the object
  Stations.query(function(data) {

        for(var i = 0; i<data.length; i = i +1) {
            stations[i] = (data[i]);
        }

        console.log($scope.stations);
    });


//Calls StationHelper factorys function to search stations based on users input
//This is used for autocompleting the departure station textfield
  $scope.searchDeparture = function() {
  
  StationHelper.searchStations($scope.data.departure).then(
    function(matches) {
      $scope.data.stations = matches;
      destinationEdited = false;
      console.log(matches[0].stationName)
    }
   ) 
  }

//Calls StationHelper factorys function to search stations based on users input
//This is used for autocompleting the destination station textfield
  $scope.searchDestination = function() {

    StationHelper.searchStations($scope.data.destination).then(
      function(matches) {
        $scope.data.stations = matches;
        destinationEdited = true;
        console.log(matches[0].stationName)
      }
    )
  }


// Compares if the parameter date object is in the past
// or in the future
  $scope.isTimePassed = function(dateToCompare) {

    var currentTime = new Date();

    var date2 = new Date(dateToCompare);

    if(date2>currentTime) {
      return false;
    } else {
      return true;
    }

  }

  // Called when user clicks desired train.
  // Fetches information from the clicked train and 
  // puts them to the screen. Information consist from things
  // such as departure and arrival time, count of wagons, progess
  // of the trip and image of the train.
  $scope.trainClicked = function(train, departure, destination) {

    tempDeparture = departure;
    tempDestination = destination;


    // odottaa että tabin html-template on latautunut,
    // jonka jälkeen asettaa junan tiedot html-tiedostoon

    //This "hack" waits for the html to load, and starts excecuting the code 
    // further after that
    function waitForTabLoading() {
      if (document.getElementById("timeInfo") == null) {
        setTimeout(waitForTabLoading, 50); //wait 50 millisecnds then recheck
        return;
      }

      document.getElementById("progressBar").innerHTML = ""


      console.log("swag:" + destinationShortCode);
      var detailHTML = '<div class="row">'
      var progressBarHTML = '<div class="row"><div class="col col-10" id="progress-label" align="center"><p>' + departureShortCode + '</p></div>'
      var stationRowHTML = '<div class="row" ><div class="col col-50" id="stationRow" align="center">' + departureShortCode + '</div><div class="col col-50" id="stationRow" align="center">' + destinationShortCode + '</div></div>'
      var departureFound = false;
      var arrivalFound = 0;

      var c = 0;
      for (var i = 0; i < train.timeTableRows.length; i = i + 1) {
        console.log('timetablerows length' + train.timeTableRows.length);

        //counting and creating the stops and progress for the progressbar
        if (!$scope.isTimePassed(train.timeTableRows[i].scheduledTime) && train.timeTableRows[i].commercialStop && train.timeTableRows[i].type == "ARRIVAL" && departureFound && arrivalFound < 2) {

          if(arrivalFound == 1) {
            arrivalFound = 2;
          }
          c = c + 1
          console.log('ewd' + c);
          progressBarHTML += '<div class="col" id="trainnotprogressed">' + train.timeTableRows[i].stationShortCode + '</div>'
        } else if ($scope.isTimePassed(train.timeTableRows[i].scheduledTime) && train.timeTableRows[i].commercialStop && train.timeTableRows[i].type == "ARRIVAL" && departureFound && arrivalFound < 2 ) {
          progressBarHTML += '<div class="col" id="trainprogressed">' + train.timeTableRows[i].stationShortCode + '</div>'
          if(arrivalFound == 1) {
            arrivalFound = 2;
          }
          
          c = c + 1
          console.log('ii' + c);
        }

        //creating the times for departure and arrival
        if (train.timeTableRows[i].stationShortCode == departureShortCode && train.timeTableRows[i].type == "DEPARTURE") {
          console.log("lähtöaika: " + train.timeTableRows[i].scheduledTime)

          detailHTML = detailHTML + '<div class="col"><h4 align="center">Lähtöaika: </h4><h2 align="center">' + formatDateToString(train.timeTableRows[i].scheduledTime, true, ":") + '</h2></div>';
          departureFound = true;
        } else if (train.timeTableRows[i].stationShortCode == destinationShortCode && train.timeTableRows[i].type == "ARRIVAL") {
          console.log("destinationFound")
          arrivalFound = 1;
          detailHTML = detailHTML + '<div class="col"><h4 align="center">Saapumisaika: </h4><h2 align="center">' + formatDateToString(train.timeTableRows[i].scheduledTime, true, ":") + '</h2></div>';
        }
        if (i == train.timeTableRows.length - 1) {
          console.log('yay!');
          progressBarHTML += '<div class="col col-10" id="progress-label" align="center"><p>' + destinationShortCode + '</p></div></div>'

          document.getElementById("progressBar").innerHTML = progressBarHTML
        }
        console.log('i is ' + i);
      }


      if (train.runningCurrently) {
        document.getElementById("isOnRoute").innerHTML = "<p>Juna ei ole pysähtynyt</p>"

      } else {
        document.getElementById("isOnRoute").innerHTML = "<p>Juna on pysähtynyt</p>"
      }



      document.getElementById("stationRow").innerHTML = stationRowHTML

      //Creating the image of the train.
      // Fetches the trains composition from the API
      // so that the wagons can be counted
      var compPromise = getTrainComposition(train);

      compPromise.then(function(result) {
        setWagonImages(0)
        setWagonData(result, setWagonImages)
      });


      document.getElementById("timeInfo").innerHTML = detailHTML + '</div>'

    }

    waitForTabLoading();

  }

//Fetches the trains composition from the API
getTrainComposition = function(train) {

  var temp = {};
    var defer = $q.defer();
    $http.get('http://rata.digitraffic.fi/api/v1/compositions/' + train.trainNumber + '?departure_date=' + train.departureDate).success(function(data){
            temp =data;
            defer.resolve(data);

    });
    return defer.promise;
}

// Counts the wagons of the train and lays some 
// info of the wagons to the screen, then calls a 
// method that draws the train based on the count of wagons
setWagonData = function(data, callback) {
  document.getElementById("wagonDesc").innerHTML = "";

  var wagonCount = 0;
  var wagonHTML = '';
  var forcount = 0;
  var catCheck = false;

  if(data.journeySections != null) {
  console.log("lenght :" + data.journeySections.length);
    for(var i = 0; i<data.journeySections.length; i = i + 1) {

      if(data.journeySections[i].beginTimeTableRow.stationShortCode == departureShortCode) {

          if(data.journeySections[i].wagons != null) {
            wagonCount = data.journeySections[i].wagons.length

            for(var j = 0;j<data.journeySections[i].wagons.length;j++) {
              console.log(data.journeySections[i].wagons[j]);

              if(data.journeySections[i].wagons[j].catering && !catCheck) {
                 document.getElementById("wagonDesc").innerHTML += '<p>Junassa on ravintolavaunu</p>'
                 catCheck = true;
                 console.log("catCheck");
              }
            }
          }

          forcount += 1

          console.log("forcoutn: " + forcount)

      } else if(data.journeySections[i].wagons != null) {
          if(wagonCount == 0) {

           wagonCount = data.journeySections[i].wagons.length
          }
          forcount += 1
          console.log("forcoutn: " + forcount)
      }

      if(i == data.journeySections.length-1) {
          console.log("let's call callback!")
          document.getElementById("wagonDesc").innerHTML += '<p>Vaunuja junassa: ' + wagonCount + '</p>';
          callback(wagonCount);

      }
    }
  }
}


//Draws the wagons to the screen
setWagonImages = function(wagonCount) {

  

  if(wagonCount != 0) {

    var wagonHTML = "<div class='row'>";


    for(var j = 0;j<wagonCount;j = j + 1) {
      if(j == wagonCount-1) {
        wagonHTML += '<div class="col" id="trainimg"><img src="img/train.png" width="100%" alt="train"></img></div></div>'
        document.getElementById("wagonInfo").innerHTML = wagonHTML
      } else {
        wagonHTML += '<div class="col" id="trainimg" style="text-align:center;"><img src="img/wagon.png" width="100%" alt="wagon"></img></div>'
      }
    }

  } else {
    document.getElementById("wagonInfo").innerHTML = '<div align="center"><p>Vaunutietoja ei saatavilla</p>'
  }
}

$scope.fromTimeChanged = function() {
  $scope.data.fromTime 
}

$scope.toTimeChanged = function() {
  
}


// Puts the clicked stations from the list to the textfield
// and saves the stations shortcodes for future use
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
      $scope.addedToFavorites = true;
      console.log("to " + tempDestination + " from " + tempDeparture);
      sharedProperties.prepForBroadcast(tempDeparture, 
        tempDepShortCode, tempDestination, tempDestShortCode);
  }

// Called when the search button is clicked
// Fetches trains that travel the route of the user 
// selected stations from the API in selected time frame
  $scope.searchForTrains = function() {
  $scope.loading = true;
  $scope.showFavoriteButton = true;
  var queryString = '';

    if (document.getElementById('fromTime').value != "") {
      console.log("fromtime" + document.getElementById('fromTime').value)
      queryString += '&from=' + getTimeWithThreshold(document.getElementById('fromTime').value.replace(/-/g, '/').replace('T', ' '));
    } else {
      queryString += '&from=' + getTimeWithThreshold(new Date()).toString();
      console.log("date with threshold:" + queryString);
    }

    if (document.getElementById('toTime').value != "" && document.getElementById('toTime').value != "") {
      console.log("totime" + document.getElementById('toTime').value)
      queryString += '&to=' + getTimeWithThreshold(document.getElementById('toTime').value.replace(/-/g, '/').replace('T', ' '));
    }
    console.log("querystring: " + queryString);
    $http.get('http://rata.digitraffic.fi/api/v1/schedules?departure_station=' + departureShortCode + '&arrival_station=' + destinationShortCode + queryString + '&limit=20').success(function(data) {

      console.log(data)
      console.log(data.code)

      if (data.code != "TRAIN_NOT_FOUND") {
        $scope.data.trains = data;


        for (var j = 0; j < $scope.data.trains.length; j = j + 1) {


          for (var i = 0; i < $scope.data.trains[j].timeTableRows.length; i = i + 1) {
            if ($scope.data.trains[j].timeTableRows[i].stationShortCode == departureShortCode && $scope.data.trains[j].timeTableRows[i].type == "DEPARTURE") {

              $scope.data.trains[j].depTime = formatDateToString($scope.data.trains[j].timeTableRows[i].scheduledTime, true, ":");
              $scope.data.trains[j].date = formatDateToString($scope.data.trains[j].timeTableRows[i].scheduledTime, false, ".");

            } else if ($scope.data.trains[j].timeTableRows[i].stationShortCode == destinationShortCode && $scope.data.trains[j].timeTableRows[i].type == "ARRIVAL") {

              $scope.data.trains[j].desTime = formatDateToString($scope.data.trains[j].timeTableRows[i].scheduledTime, true, ":");
            }
          }
        }

        if ($scope.data.trains != null) {
          trainsFound = true;
          $scope.loading = false;
        }

      } else {
        alert("Hei! Junia ei löytynyt... Tarkista syöte ja huomioi, että Junatutka ei tällä hetkellä tue jatkoyhteyksiä.")
      }

    });
  }


}]);

// Controller for the database
app.controller("DBCtrl", ['$scope', '$cordovaSQLite', 'sharedProperties', '$ionicPopup', '$http', function($scope, $cordovaSQLite, sharedProperties, $ionicPopup, $http) {
    var objToInsert = {};
    $scope.favArray = [];
    var trains;

    // Listen to a broadcast from another controller
    $scope.$on("handleBroadcast", function() {
        objToInsert = {"toStation":       sharedProperties.toStation, 
                       "toStationCode":   sharedProperties.toStationCode,
                       "fromStation":     sharedProperties.fromStation, 
                       "fromStationCode": sharedProperties.fromStationCode};
        console.log("broadcast insert");
        insert();
    });

    selectAllFromTable();   

    // Insert into database
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
        selectAllFromTable();
    }

    // Select a route from favorites
    $scope.select = function(favorite) {
        fetchTrainData(favorite);
    }

    // Fetch all data
    $scope.refresh = function() {
        selectAllFromTable();
    }

    // Delete selected item from the database
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

    // Create a table and insert it into a popup
    function createPopup(trains, favorite) {
      console.log("back ");

      var output = "<table class='pure-table-horizontal' id='favoriteTable'> <thead></thead><tr><th></th><th></th><th></th><th></th></tr><tbody>";
      
      for (var i = 0; i < trains.length; i++) {
        output += "<tr>"
        output += "<td id='favoriteTd'><text-e id='train-time'>" + trains[i].depTime + 
                  "</text-e></td><td id='favoriteTd'><text-e id='train-time'>-</text-e></td><td id='favoriteTd'><text-e id='train-time'>" + 
                  trains[i].desTime + "</text-e></td>";
        output += "<td id='favoriteTd'><text-e id='train-name'>" + trains[i].trainType + trains[i].trainNumber + "</text-e></td>";
        output += "</tr>";
      }

      output += "</tbody></table>";

      var alertPopup = $ionicPopup.alert({
        title: favorite.fromStation + " - " + favorite.toStation + "<br> Seuraavat lähdöt:",
        template: output
        });
        alertPopup.then(function(res) {
      });
    }
 
    // Fetch 
    function fetchTrainData(favorite) {
      var departureShortCode   = favorite.fromStationCode;
      var destinationShortCode = favorite.toStationCode;
      var queryString = '';
    
      $http.get('http://rata.digitraffic.fi/api/v1/schedules?departure_station='+ departureShortCode + '&arrival_station=' + destinationShortCode + queryString + '&limit=20').success(function(data) {
        trains = data;
        console.log(data)
    
        for(var j = 0;j<trains.length;j = j +1) {
          for(var i = 0; i < trains[j].timeTableRows.length; i = i + 1) {
            if(trains[j].timeTableRows[i].stationShortCode == departureShortCode && trains[j].timeTableRows[i].type =="DEPARTURE") {
              console.log("lähtöaika: " + trains[j].timeTableRows[i].scheduledTime)
              trains[j].depTime = formatDateToTime(trains[j].timeTableRows[i].scheduledTime);
            } else if (trains[j].timeTableRows[i].stationShortCode == destinationShortCode && trains[j].timeTableRows[i].type =="ARRIVAL") {
              trains[j].desTime = formatDateToTime(trains[j].timeTableRows[i].scheduledTime);
            }
          }
        }

        createPopup(trains, favorite);
      });
    }

    // Get all data from the database
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

// Returns a date string with semi-hardcoded threshold
function getTimeWithThreshold(date) {

  var d = new Date(date)
  var year = '';
  var month = '';
  var day = '';
  var hour = '';
  var minutes = '';
  var seconds = '';
  var millis = '';

  d.setHours(d.getHours() - 3);

  year = d.getFullYear().toString();

  if (d.getMonth() < 10) {
    month = '0' + (d.getMonth() + 1).toString();
  } else {
    month = (d.getMonth() + 1).toString();
  }
  if (d.getDate() < 10) {
    day = '0' + d.getDate().toString();
  } else {
    day = d.getDate().toString();
  }
  if (d.getHours() < 10) {
    hours = '0' + d.getHours().toString();
  } else {
    hours = d.getHours().toString();
  }

  if (d.getMinutes() < 10) {
    minutes = '0' + d.getMinutes().toString();
  } else {
    minutes = d.getMinutes().toString();
  }


  seconds = d.getMinutes().toString();


  if (d.getMilliseconds() < 10) {
    millis = '00' + d.getMilliseconds().toString();
  } else if (d.getMilliseconds() < 100) {
    millis = '0' + d.getMilliseconds().toString();
  } else {
    millis = d.getMilliseconds().toString();
  }

  var returntime = year + "-" + month + '-' + day + 'T' + hours + ':' + minutes + ':' + seconds + '.' + millis + 'Z'
  return returntime;

}

function formatDateToString(date, isTime, separator) {
    var d = new Date(date);
    var hours = '';
    var minutes = ''
    var day = ''
    var month = ''
    var year = ''
    if(isTime) {
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

    var time = hours + separator + minutes;

    return time;
  } else {
     
        day =  d.getDate().toString();
        console.log("day:" + day);
        

      
        month =  (d.getMonth() + 1).toString();

        year = d.getFullYear().toString().substring(2,4);
      

        var time = day + separator + month + separator + year;

     return time;
  }
}

function formatDateToTime(date) {
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
