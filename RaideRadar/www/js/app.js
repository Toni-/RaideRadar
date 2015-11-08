var stations = []

console.log(stations);

var app = angular.module('radar', ['ionic', 'ngResource']);

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

app.factory("Stations", function($resource) {
    return $resource("http://rata.digitraffic.fi/api/v1/metadata/stations");
});

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

        }, 100);

        return deferred.promise;

    };

    return {

        searchStations : searchStations

    }
})

app.controller("ScheduleCtrl", ['$scope', '$http', 'Stations', 'StationHelper', function($scope, $http, Stations, StationHelper) {

  //$scope.stations = [];
  $scope.data = { "stations" : [], "search" : '' };

  Stations.query(function(data) {
        
        for(value in data) {
            stations[value] = (data[value]);
        }

        console.log($scope.stations);
    });


  $scope.searchDeparture = function() {

  StationHelper.searchStations($scope.data.departure).then(
    function(matches) {
      $scope.data.stations = matches;
      console.log(matches[0].stationName)
    }
  )
}
$scope.searchDestination = function() {

  StationHelper.searchStations($scope.data.destination).then(
    function(matches) {
      $scope.data.stations = matches;
      console.log(matches[0].stationName)
    }
  )
}


}]);