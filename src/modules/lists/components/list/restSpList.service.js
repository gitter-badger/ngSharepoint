angular
    .module('ngSharepoint.Lists')
    .factory('RestSPList', function($q, $sp, $spLoader) {
        var RestSPList = function(title) {
            this.title = title;
        };
        RestSPList.prototype.read = function(query) {
            var endpoint = '_api/web/Lists/GetByTitle(\'' + this.title + '\')/GetItems';
            var body = {
                query: {
                    __metadata: {
                        type: 'SP.CamlQuery'
                    },
                    ViewXml: query
                }
            };
            return $q(function(resolve, reject) {
                $spLoader.query({
                    method: 'POST',
                    url: endpoint,
                    data: body
                }).then(function(data) {
                    //TODO: Parse Result
                }, reject);
            });
        };
        RestSPList.prototype.create = function(data) {
            var endpoint = '_api/web/Lists/GetByTitle(\'' + this.title + '\')/items';
            var body = {
                __metadata: {
                    type: 'SP.Data.TestListItem'
                }
            };
            Object.getOwnPropertyNames(data).forEach(function(key) {
                var value = data[key];
                if (angular.isDefined(value) && value !== null && angular.isString(value)) {
                    value = value.trim();
                }
                body[key] = value;
            });
            return $q(function(resolve, reject) {
                $spLoader.query({
                    method: 'POST',
                    url: endpoint,
                    data: body
                }).then(function(data) {
                    //TODO: Parse Result
                }, reject);
            });
        };
        RestSPList.prototype.delete = function(query) {
            //TODO: Implement
        };
        RestSPList.prototype.update = function(query, data) {
            //TODO: Implement
        };
        return (RestSPList);
    });
