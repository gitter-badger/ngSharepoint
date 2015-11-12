angular
    .module('ngSharepoint.Users', ['ngSharepoint'])
    .run(['$sp', '$spLoader', function($sp, $spLoader) {
        if ($sp.getAutoload()) {
            if ($sp.getConnectionMode() === 'JSOM') {
                $spLoader.loadScript($sp.getSiteUrl() + '/_layouts/15/SP.Userprofiles.js');
            }
        }
    }]);