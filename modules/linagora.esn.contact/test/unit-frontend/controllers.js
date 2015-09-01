'use strict';

/* global chai: false */
/* global sinon: false */

var expect = chai.expect;

describe('The Contacts Angular module', function() {

  var $rootScope, $controller, $timeout, scope, bookId = '123456789', contactsService,
      notificationFactory, $location, $route, selectionService, $alert, gracePeriodService, sharedDataService,
      sortedContacts, liveRefreshContactService;

  beforeEach(function() {

    contactsService = {
      shellToVCARD: function() {
        return scope.contact;
      },
      getCard: function() {
        return $q.when(scope.contact);
      }
    };
    liveRefreshContactService = {
      startListen: function() {},
      stopListen: function() {}
    };
    notificationFactory = {
      weakError: sinon.spy(),
      weakInfo: sinon.spy()
    };
    $location = {
      path: function() {}
    };
    $route = {
      current: {
        params: {
          bookId: bookId
        }
      }
    };
    selectionService = {
      clear: function() {}
    };
    $alert = {
      alert: function() {}
    };
    gracePeriodService = {
      grace: function() {
        return {
          then: function() {}
        };
      },
      cancel: function() {}
    };

    angular.mock.module('ngRoute');
    angular.mock.module('esn.core');

    module('linagora.esn.contact', function($provide) {
      $provide.value('contactsService', contactsService);
      $provide.value('liveRefreshContactService', liveRefreshContactService);
      $provide.value('notificationFactory', notificationFactory);
      $provide.value('$location', $location);
      $provide.value('selectionService', selectionService);
      $provide.value('$route', $route);
      $provide.value('$alert', function(options) { $alert.alert(options); });
      $provide.value('gracePeriodService', gracePeriodService);
    });
  });

  beforeEach(angular.mock.inject(function(_$rootScope_, _$controller_, _$timeout_, _sharedDataService_, ALPHA_ITEMS) {
    $rootScope = _$rootScope_;
    $controller = _$controller_;
    $timeout = _$timeout_;
    sharedDataService = _sharedDataService_;
    sortedContacts = ALPHA_ITEMS.split('').reduce(function(a, b) {
      a[b] = [];

      return a;
    }, {});

    scope = $rootScope.$new();
    scope.contact = {};
  }));

  describe('the newContactController', function() {

    beforeEach(function() {
      $controller('newContactController', {
        $scope: scope
      });
    });

    it('should initialize $scope.contact to an already existing one when defined', function() {
      var scope = {},
          contact = {lastName: 'Last'};

      $controller('newContactController', {
        $scope: scope,
        sharedDataService: {
          contact: contact
        }
      });

      expect(scope.contact).to.deep.equal(contact);
    });

    it('should clear sharedDataService.contact after initialization', function() {
      var scope = {},
          contact = {lastName: 'Last'},
          sharedDataService = {
            contact: contact
          };

      $controller('newContactController', {
        $scope: scope,
        sharedDataService: sharedDataService
      });

      expect(sharedDataService.contact).to.deep.equal({});
    });

    it('should go back to the list of contacts when close is called', function(done) {
      $location.path = function(path) {
        expect(path).to.equal('/contact');
        done();
      };

      scope.close();
    });

    describe('the accept function', function() {

      it('should not call contactsService.create when already calling it', function(done) {
        scope.calling = true;
        contactsService.create = function() {
          return done(new Error('This test should not call contactsService.create'));
        };
        scope.accept();
        done();
      });

      it('should not call contactsService.create when contact is not valid', function(done) {
        contactsService.create = function() {
          return done(new Error('This test should not call contactsService.create'));
        };
        scope.accept();
        done();
      });

      it('should display an error when contact is not valid', function(done) {
        contactsService.create = function() {
          return done(new Error('This test should not call contactsService.create'));
        };
        $alert.alert = function() { done(); };

        scope.accept();
        scope.$digest();
      });

      it('should not grace the request when contact is not valid', function(done) {
        gracePeriodService.grace = done;

        scope.accept();
        scope.$digest();

        done();
      });

      it('should call contactsService.create with right bookId and contact', function(done) {
        scope.contact = { firstName: 'Foo', lastName: 'Bar' };
        contactsService.create = function(id, contact) {
          expect(id).to.equal(bookId);
          expect(contact).to.deep.equal(scope.contact);

          done();
        };
        scope.accept();
      });

      it('should change page on contactsService.create success', function(done) {
        scope.contact = {_id: 1, firstName: 'Foo', lastName: 'Bar'};

        $location.path = function(path) {
          expect(path).to.equal('/contact');

          done();
        };

        contactsService.create = function() {
          return $q.when();
        };

        scope.accept();
        scope.$digest();
      });

      it('should not change page if the contact is invalid', function(done) {
        $location.path = function() {
          done('This test should not change the location');
        };

        scope.accept();
        scope.$digest();

        done();
      });

      it('should notify user on contactsService.create failure', function(done) {
        scope.contact = {_id: 1, firstName: 'Foo', lastName: 'Bar'};

        $location.path = function() {
          done(new Error('This test should not change the location'));
        };

        notificationFactory.weakError = function() {
          done();
        };

        contactsService.create = function() {
          return $q.reject('WTF');
        };

        scope.accept();
        scope.$digest();
      });

      it('should set back the calling flag to false when complete', function(done) {
        scope.contact = {_id: 1, firstName: 'Foo', lastName: 'Bar'};
        $location.path = function() {};

        contactsService.create = function() {
          return $q.when();
        };

        scope.accept().then(function() {
          expect(scope.calling).to.be.false;

          done();
        });
        scope.$digest();
      });

      it('should grace the request using the default delay on success', function(done) {
        scope.contact = {firstName: 'Foo', lastName: 'Bar'};

        gracePeriodService.grace = function(taskId, text, linkText, delay) {
          expect(delay).to.not.exist;

          done();
        };

        contactsService.create = function() {
          return $q.when();
        };

        scope.accept();
        scope.$digest();
      });

      it('should display correct title and link during the grace period', function(done) {
        scope.contact = {firstName: 'Foo', lastName: 'Bar', id: 'myTaskId'};

        gracePeriodService.grace = function(taskId, text, linkText, delay) {
          expect(taskId).to.equals('myTaskId');
          expect(text).to.equals('You have just created a new contact (Foo Bar).');
          expect(linkText).to.equals('Cancel and back to edition');
          expect(delay).to.not.exist;
          done();
        };

        contactsService.create = function() {
          return $q.when();
        };

        scope.accept();
        scope.$digest();
      });

      it('should not grace the request on contactsService.create failure', function(done) {
        scope.contact = {firstName: 'Foo', lastName: 'Bar'};

        gracePeriodService.grace = done;

        contactsService.create = function() {
          return $q.reject();
        };

        scope.accept();
        scope.$digest();

        done();
      });

      it('should delete the contact if the user cancels during the grace period', function(done) {
        scope.contact = {firstName: 'Foo', lastName: 'Bar'};

        gracePeriodService.grace = function() {
          return $q.when({cancelled: true,
            success: function(textToDisplay) {
            },
            error: function(textToDisplay) {
            }});
        };
        contactsService.create = function() {
          return $q.when();
        };
        contactsService.remove = function(id, contact) {
          expect(id).to.equal(bookId);
          expect(contact).to.deep.equal(scope.contact);

          done();
        };

        scope.accept();
        scope.$digest();
      });

      it('should notice the user that the contact creation can\'t be cancelled', function(done) {
        scope.contact = {firstName: 'Foo', lastName: 'Bar'};

        gracePeriodService.grace = function() {
          return $q.when({cancelled: true,
            success: function(textToDisplay) {
            },
            error: function(textToDisplay) {
              done();
            }});
        };
        contactsService.create = function() {
          return $q.when();
        };
        contactsService.remove = function(id, contact) {
          expect(id).to.equal(bookId);
          expect(contact).to.deep.equal(scope.contact);

          return $q.reject();
        };

        scope.accept();
        scope.$digest();
      });

      it('should go back to the editing form if the user cancels during the grace period, saving the contact', function(done) {
        scope.contact = {firstName: 'Foo', lastName: 'Bar', title: 'PDG'};

        gracePeriodService.grace = function() {
          return $q.when({cancelled: true,
            success: function(textToDisplay) {
            },
            error: function(textToDisplay) {
            }});
        };
        contactsService.create = function() {
          return $q.when();
        };
        contactsService.remove = function(id, contact) {
          $location.path = function(path) {
            expect(path).to.equal('/contact/new/' + bookId);
            expect(sharedDataService.contact).to.deep.equal(scope.contact);

            done();
          };

          return $q.when();
        };

        scope.accept();
        scope.$digest();
      });

    });
  });

  describe('The showContactController', function() {

    beforeEach(function() {
      this.initController = $controller.bind(null, 'showContactController', { $scope: scope});
    });

    it('should go back to the list of contacts when close is called', function(done) {
      $location.path = function(path) {
        expect(path).to.equal('/contact');
        done();
      };

      this.initController();
      scope.close();
    });

    it('should display an error if the contact cannot be loaded initially', function(done) {
      contactsService.getCard = function() {
        return $q.reject('WTF');
      };
      $alert.alert = function() { done(); };

      this.initController();
      scope.$digest();
    });
    describe('The modify function', function() {

      it('should not call contactsService.modify when already calling it', function() {
        scope.calling = true;
        contactsService.modify = function() {
          throw new Error('This test should not call contactsService.modify');
        };

        this.initController();
        scope.modify();
        $timeout.flush();
      });

      it('should not call contactsService.modify when contact is not valid', function() {
        contactsService.modify = function() {
          throw new Error('This test should not call contactsService.modify');
        };

        this.initController();
        scope.modify();
        $timeout.flush();
      });

      it('should display an error when contact is not valid', function(done) {
        contactsService.modify = function() {
          return done(new Error('This test should not call contactsService.create'));
        };
        $alert.alert = function() { done(); };

        this.initController();
        scope.modify();
        $timeout.flush();
      });

      it('should call contactsService.modify with right bookId and contact', function(done) {
        scope.contact = { id: 1, firstName: 'Foo', lastName: 'Bar' };
        contactsService.modify = function(id, contact) {
          expect(id).to.deep.equal(bookId);
          expect(contact).to.deep.equal(scope.contact);
          done();
        };

        contactsService.getCard = function(path) {
          return $q.when({_id: 1, firstName: 'Foo', lastName: 'Bar'});
        };

        this.initController();
        scope.modify();
        $timeout.flush();
      });

      it('should notify user on contactsService.modify failure', function(done) {
        $location.path = function() {
          done(new Error('This test should not change the location !'));
        };
        var displayError;
        displayError = done();
        contactsService.modify = function() {
          return $q.reject();
        };
        contactsService.getCard = function(path) {
          return $q.when({_id: 1, firstName: 'Foo', lastName: 'Bar'});
        };

        this.initController();
        scope.modify();
        $timeout.flush();
      });

      it('should set back the calling flag to false when complete', function() {

        scope.contact = {_id: 1, firstName: 'Foo', lastName: 'Bar'};
        contactsService.modify = function() {
          return $q.when(scope.contact);
        };
        contactsService.getCard = function() {
          return $q.when({_id: 1, firstName: 'Foo', lastName: 'Bar'});
        };
        this.initController();
        scope.modify();
        $timeout.flush();
        expect(scope.calling).to.be.false;

      });

    });

    describe('The deleteContact function', function() {

      it('should go back to the list of contacts when called', function(done) {
        $location.path = function(path) {
          expect(path).to.equal('/contact');
          done();
        };
        this.initController();
        scope.deleteContact();
      });

      it('should call contactsService.remove with the right bookId and cardId', function(done) {
        scope.contact = { id: 1, firstName: 'Foo', lastName: 'Bar' };
        contactsService.deleteContact = function(id, contact) {
          expect(id).to.deep.equal(bookId);
          expect(contact).to.deep.equal(scope.contact);
          done();
      };

        contactsService.getCard = function(path) {
          return $q.when({_id: 1, firstName: 'Foo', lastName: 'Bar'});
        };

        this.initController();
        scope.deleteContact();
        $timeout.flush();
      });
    });

  });

  describe('the contactAvatarModalController', function() {

    beforeEach(function() {
      $controller('contactAvatarModalController', {$scope: scope});
    });

    describe('the saveContactAvatar method', function() {
      it('should do nothing if no image is selected', function() {
        selectionService.getImage = function() {
          return false;
        };
        scope.saveContactAvatar();
        expect(scope.contact.photo).to.not.exist;
      });

      it('should add the image as base64 string to the contact and close the modal', function() {
        var blob = 'theblob';
        var imageAsBase64 = 'image';
        var modalHidden = false;

        scope.modify = function() {
          return $q.when(scope.contact);
        };

        window.FileReader = function() {
          return {
            readAsDataURL: function(data) {
              expect(data).to.equal(blob);
              this.result = imageAsBase64;
              this.onloadend();
            }
          };
        };

        selectionService.getImage = function() {
          return true;
        };
        selectionService.getBlob = function(mimetype, callback) {
          return callback(blob);
        };

        scope.modal = {
          hide: function() {
            modalHidden = true;
          }
        };

        scope.saveContactAvatar();
        expect(scope.loading).to.be.false;
        expect(modalHidden).to.be.true;
        expect(scope.contact.photo).to.equal(imageAsBase64);
      });
    });

  });

  describe('The editContactController controller', function() {

    beforeEach(function() {
      this.initController = $controller.bind(null, 'editContactController', { $scope: scope});
    });

    describe('The save function', function() {

        it('should call contactsService.modify with the right bookId and cardId', function(done) {
          scope.contact = { id: 1, firstName: 'Foo', lastName: 'Bar' };
          contactsService.modify = function(id, contact) {
            expect(id).to.deep.equal(bookId);
            expect(contact).to.deep.equal(scope.contact);
            done();
          };

          contactsService.getCard = function(path) {
            return $q.when({_id: 1, firstName: 'Foo', lastName: 'Bar'});
          };

          this.initController();
          scope.save();
        });

        it('should go back to contact visualization page if success', function(done) {
          scope.contact = {_id: 1, firstName: 'Foo', lastName: 'Bar'};

          $location.path = function(path) {
            expect(path).to.equal('/contact/show/' + scope.bookId + '/' + scope.cardId);
            done();
          };

          contactsService.modify = function() {
            return $q.when({_id: 1, firstName: 'Foo', lastName: 'Bar'});
          };
          this.initController();
          scope.save();
          scope.$digest();
        });

        it('should not change page if the contact is invalid', function(done) {
          $location.path = function() {
            done('This test should not change the location');
          };
          contactsService.modify = function() {
            return $q.reject();
          };
          this.initController();
          scope.save();
          done();
        });

    });

    describe('The deleteContact function', function() {

        it('should go back to the list of contacts when called', function(done) {
          $location.path = function(path) {
            expect(path).to.equal('/contact');
            done();
          };
          this.initController();
          scope.deleteContact();
        });

        it('should call contactsService.remove with the right bookId and cardId', function(done) {
          scope.contact = { id: 1, firstName: 'Foo', lastName: 'Bar' };
          contactsService.deleteContact = function(id, contact) {
            expect(id).to.deep.equal(bookId);
            expect(contact).to.deep.equal(scope.contact);
            done();
          };

          contactsService.getCard = function(path) {
            return $q.when({_id: 1, firstName: 'Foo', lastName: 'Bar'});
          };

          this.initController();
          scope.deleteContact();
          $timeout.flush();
        });
    });

  });

  describe('The contactsListController controller', function() {

    it('should gracePeriodService.flushAllTasks $on(\'$destroy\')', function() {
      gracePeriodService.flushAllTasks = sinon.spy();
      $controller('contactsListController', {
        $scope: scope,
        contactsService: {
          list: function() {
            return $q.reject('WTF');
          }
        },
        user: {
          _id: '123'
        }
      });
      scope.$destroy();
      $rootScope.$digest();
      expect(gracePeriodService.flushAllTasks).to.have.been.called;
    });

    it('should register gracePeriodService.flushAllTasks on(\'beforeunload\')', function() {
      gracePeriodService.flushAllTasks = 'aHandler';
      var event = null;
      var handler = null;
      this.$window.addEventListener = function(evt, hdlr) {
        event = evt;
        handler = hdlr;
      };
      $controller('contactsListController', {
        $scope: scope,
        contactsService: {
          list: function() {
            return $q.reject('WTF');
          }
        },
        user: {
          _id: '123'
        }
      });
      $rootScope.$digest();
      expect(event).to.equal('beforeunload');
      expect(handler).to.equal('aHandler');
    });

    it('should add the contact to the list on delete cancellation', function(done) {
      var contact = {
        lastName: 'Last'
      };

      $controller('contactsListController', {
        $scope: scope,
        contactsService: {
          list: function() {
            return $q.reject('WTF');
          }
        },
        user: {
          _id: '123'
        },
        AlphaCategoryService: function() {
          return {
            addItems: function(data) {
              expect(data).to.deep.equal([contact]);

              done();
            },
            get: function() {}
          };
        }
      });

      $rootScope.$broadcast('contact:cancel:delete', contact);
      $rootScope.$digest();
    });

    it('should add the contact to the list on contact:live:created event', function(done) {
      var contact = {
        lastName: 'Last'
      };

      $controller('contactsListController', {
        $scope: scope,
        contactsService: {
          list: function() {
            return $q.reject('WTF');
          }
        },
        user: {
          _id: '123'
        },
        AlphaCategoryService: function() {
          return {
            addItems: function(data) {
              expect(data).to.deep.equal([contact]);

              done();
            },
            get: function() {}
          };
        }
      });

      $rootScope.$broadcast('contact:live:created', contact);
      $rootScope.$digest();
    });

    it('should remove the contact from the list on contact:live:deleted event', function(done) {
      var contact = {
        id: 'myid',
        lastName: 'Last'
      };

      $controller('contactsListController', {
        $scope: scope,
        contactsService: {
          list: function() {
            return $q.reject('WTF');
          }
        },
        user: {
          _id: '123'
        },
        AlphaCategoryService: function() {
          return {
            removeItemWithId: function(contactId) {
              expect(contactId).to.equal('myid');

              done();
            },
            get: function() {}
          };
        }
      });

      $rootScope.$broadcast('contact:live:deleted', contact);
      $rootScope.$digest();
    });

    it('should add no item to the categories when contactsService.list returns an empty list', function() {
      contactsService.list = function() {
        return $q.when([]);
      };

      $controller('contactsListController', {
        $scope: scope,
        user: {
          _id: '123'
        }
      });

      $rootScope.$digest();

      $timeout(function() {
        expect(scope.sorted_contacts).to.deep.equal(sortedContacts);
      });
    });

    it('should sort contacts by FN', function() {
      var contactWithA = { displayName: 'A B'},
          contactWithC = { displayName: 'C D' };

      contactsService.list = function() {
        return $q.when([contactWithA, contactWithC]);
      };

      $controller('contactsListController', {
        $scope: scope,
        user: {
          _id: '123'
        }
      });

      sortedContacts.A = [contactWithA];
      sortedContacts.C = [contactWithC];

      $rootScope.$digest();

      $timeout(function() {
        expect(scope.sorted_contacts).to.deep.equal(sortedContacts);
      });
    });

    it('should correctly sort contacts when multiple contacts have the same FN', function() {
      var contact1 = { displayName: 'A B'},
          contact2 = { displayName: 'A B' };

      contactsService.list = function() {
        return $q.when([contact1, contact2]);
      };

      $controller('contactsListController', {
        $scope: scope,
        user: {
          _id: '123'
        }
      });

      sortedContacts.A = [contact1, contact2];

      $rootScope.$digest();

      $timeout(function() {
        expect(scope.sorted_contacts).to.deep.equal(sortedContacts);
      });
    });

    it('should correctly sort contacts when multiple contacts have the same beginning of FN', function() {
      var contact1 = { displayName: 'A B'},
          contact2 = { displayName: 'A C' };

      contactsService.list = function() {
        return $q.when([contact1, contact2]);
      };

      $controller('contactsListController', {
        $scope: scope,
        user: {
          _id: '123'
        }
      });

      sortedContacts.A = [contact1, contact2];

      $rootScope.$digest();

      $timeout(function() {
        expect(scope.sorted_contacts).to.deep.equal(sortedContacts);
      });
    });

    it('should correctly sort contacts when some contacts does not have FN', function() {
      var contact1 = { firstName: 'A'},
          contact2 = { displayName: 'A C'},
          contact3 = { id: '123' };

      contactsService.list = function() {
        return $q.when([contact1, contact2, contact3]);
      };

      $controller('contactsListController', {
        $scope: scope,
        user: {
          _id: '123'
        }
      });

      sortedContacts.A = [{displayName: contact1.firstName, firstName: contact1.firstName}, contact2];
      sortedContacts['#'] = [{displayName: contact3.id, id: contact3.id}];

      $rootScope.$digest();

      $timeout(function() {
        expect(scope.sorted_contacts).to.deep.equal(sortedContacts);
      });
    });

    it('should fire viewRenderFinished event to scroll to old position', function(done) {
      scope.$on('viewRenderFinished', function() {
        done();
      });

      $controller('contactsListController', {
        $scope: scope,
        contactsService: {
          list: function() {
            return $q.reject('WTF');
          }
        },
        user: {
          _id: '123'
        }
      });

      $rootScope.$broadcast('ngRepeatFinished');
    });

    describe('The loadContacts function', function() {

      it('should call the contactsService.list fn', function(done) {
        var user = {_id: 123};
        var contactsService = {
          list: function(bookId) {
            expect(bookId).to.equal(user._id);
            done();
          }
        };

        $controller('contactsListController', {
          $scope: scope,
          contactsService: contactsService,
          user: user
        });
        scope.loadContacts();
      });

      it('should display error when contactsService.list fails', function(done) {
        var user = {_id: 123};
        var defer = $q.defer();
        defer.reject();
        var contactsService = {
          list: function() {
            return defer.promise;
          }
        };
        $alert.alert = function(options) {
          expect(options.content).to.match(/Can not get contacts/);

          done();
        };

        $controller('contactsListController', {
          $scope: scope,
          contactsService: contactsService,
          user: user
        });

        scope.loadContacts();
        scope.$digest();
      });
    });

    describe('The openContactCreation function', function() {
      it('should open the contact creation window', function(done) {

        var user = {
          _id: 123
        };

        $location.path = function(url) {
          expect(url).to.equal('/contact/new/' + user._id);
          done();
        };

        $controller('contactsListController', {
          $scope: scope,
          contactsService: {
            list: function() {
              return $q.when({});
            }
          },
          user: user
        });

        scope.openContactCreation();
      });
    });

    describe('The search function', function() {
      it('should clean previous search results', function() {
        $controller('contactsListController', {
          $scope: scope,
          contactsService: {
            list: function() {
              return $q.when([]);
            }
          },
          user: {
            _id: '123'
          }
        });

        scope.searchResult = 1;
        scope.loadContacts = function() {};
        scope.search();
        scope.$digest();
        expect(scope.searchResult).to.deep.equal({});
        expect(scope.currentPage).to.equal(1);
      });
      it('should clean sorted_contacts', function() {
        $controller('contactsListController', {
          $scope: scope,
          contactsService: {
            list: function() {
              return $q.when([]);
            }
          },
          user: {
            _id: '123'
          },
          AlphaCategoryService: function() {
            return {
              init: function() {
              }
            };
          }
        });

        scope.sorted_contacts = 1;
        scope.loadContacts = function() {};
        scope.search();
        scope.$digest();
        expect(scope.sorted_contacts).to.not.exist;
      });

      it('should get all the user contacts when searchInput is undefined', function(done) {
        $controller('contactsListController', {
          $scope: scope,
          contactsService: {
            list: function() {
              return $q.when([]);
            }
          },
          user: {
            _id: '123'
          }
        });

        scope.loadContacts = done;
        scope.search();
        scope.$digest();
      });

      it('should call contactsService.search with right values', function(done) {
        var search = 'Bruce Willis';

        $controller('contactsListController', {
          $scope: scope,
          contactsService: {
            list: function() {
              return $q.when([]);
            },
            search: function(bookId, userId, data) {
              expect(bookId).to.equal(scope.bookId);
              expect(userId).to.equal(scope.user._id);
              expect(data).to.equal(search);
              done();
            }
          },
          user: {
            _id: '123'
          },
          bookId: '456'
        });

        scope.searchInput = search;
        scope.search();
        scope.$digest();
      });

      it('should update the contacts list on search success', function() {
        var search = 'Bruce Willis';

        var contactWithA = { displayName: 'A B'};
        var contactWithB = { displayName: 'B C'};
        var contactWithC = { displayName: 'C D'};

        var result = {
          total_hits: 2,
          current_page: 1,
          hits_list: [contactWithA, contactWithC]
        };

        $controller('contactsListController', {
          $scope: scope,
          contactsService: {
            list: function() {
              return $q.when([contactWithA, contactWithB, contactWithC]);
            },
            search: function() {
              return $q.when(result);
            }
          },
          user: {
            _id: '123'
          },
          bookId: '456'
        });

        scope.searchInput = search;
        scope.totalHits = 0;
        scope.search();
        scope.$digest();

        sortedContacts.A = [contactWithA];
        sortedContacts.C = [contactWithC];
        expect(scope.searchResult.data).to.deep.equal(result.hits_list);
        expect(scope.currentPage).to.deep.equal(result.current_page);
        expect(scope.searchResult.count).to.equal(2);
        expect(scope.searchResult.formattedResultsCount).to.exist;
        $timeout(function() {
          expect(scope.sorted_contacts).to.deep.equal(sortedContacts);
        });
      });

      it('should displayError on search failure', function(done) {
        var search = 'Bruce Willis';

        $controller('contactsListController', {
          $scope: scope,
          displayError: function(error) {
            expect(error).to.match(/Can not search contacts/);
            done();
          },
          contactsService: {
            list: function() {
              return $q.when([]);
            },
            search: function() {
              return $q.reject(new Error('WTF'));
            }
          },
          user: {
            _id: '123'
          },
          bookId: '456'
        });

        scope.searchInput = search;
        scope.search();
        scope.$digest();
      });
      it('should prevent fetching next results page while loading current result page', function() {
        var search = 'Bruce Willis';

        var contactWithA = { displayName: 'A B'};
        var contactWithB = { displayName: 'B C'};
        var contactWithC = { displayName: 'C D'};
        var contactWithD = { displayName: 'D E'};
        var contactWithE = { displayName: 'E F'};

        var result = {
          total_hits: 4,
          hits_list: [contactWithA, contactWithB]
        };

        $controller('contactsListController', {
          $scope: scope,
          contactsService: {
            list: function() {
              return $q.when([contactWithA, contactWithB, contactWithC, contactWithD, contactWithE]);
            },
            search: function() {
              return $q.when(result);
            }
          },
          user: {
            _id: '123'
          },
          bookId: '456'
        });

        scope.searchInput = search;
        scope.search();
        expect(scope.loadingNextSearchResults).to.be.true;
        scope.$digest();
        expect(scope.loadingNextSearchResults).to.be.false;
      });
      it('should allow fetching next result page when there is undisplayed results', function() {
        var search = 'Bruce Willis';

        var contactWithA = { displayName: 'A B'};
        var contactWithB = { displayName: 'B C'};
        var contactWithC = { displayName: 'C D'};
        var contactWithD = { displayName: 'D E'};
        var contactWithE = { displayName: 'E F'};

        var result = {
          total_hits: 4,
          hits_list: [contactWithA, contactWithB]
        };

        $controller('contactsListController', {
          $scope: scope,
          contactsService: {
            list: function() {
              return $q.when([contactWithA, contactWithB, contactWithC, contactWithD, contactWithE]);
            },
            search: function() {
              return $q.when(result);
            }
          },
          user: {
            _id: '123'
          },
          bookId: '456'
        });

        scope.searchInput = search;
        scope.totalHits = 0;
        scope.search();
        scope.$digest();

        expect(scope.lastPage).to.be.false;
      });
      it('should prevent fetching next result page when there is no more results', function() {
        var search = 'Bruce Willis';

        var contactWithA = { displayName: 'A B'};
        var contactWithB = { displayName: 'B C'};
        var contactWithC = { displayName: 'C D'};
        var contactWithD = { displayName: 'D E'};
        var contactWithE = { displayName: 'E F'};

        var result = {
          total_hits: 2,
          hits_list: [contactWithA, contactWithB]
        };

        $controller('contactsListController', {
          $scope: scope,
          contactsService: {
            list: function() {
              return $q.when([contactWithA, contactWithB, contactWithC, contactWithD, contactWithE]);
            },
            search: function() {
              return $q.when(result);
            }
          },
          user: {
            _id: '123'
          },
          bookId: '456'
        });

        scope.searchInput = search;
        scope.totalHits = 0;
        scope.search();
        scope.$digest();
        expect(scope.lastPage).to.be.true;
      });
    });
  });

});
