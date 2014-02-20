'use strict';

var expect = require('chai').expect;

describe('The signup confirmation email module', function() {

  before(function(done) {
    this.testEnv.writeDBConfigFile();
    var conf = require('../../../../../backend/core/esn-config')('mail');
    var mail = {
      mail: {
        noreply: 'no-reply@hiveety.org'
      },
      transport: {
        type: 'Pickup',
        config: {
          directory: this.testEnv.tmp
        }
      }
    };

    conf.store(mail, function(err) {
      done(err);
    });
  });

  after(function() {
    this.testEnv.removeDBConfigFile();
  });

  it('should send an email with valid data', function(done) {
    var tmp = this.testEnv.tmp;
    var path = require('path');
    var fs = require('fs');

    var invitation = {
      data: {
        firstname: 'Foo',
        lastname: 'Bar',
        email: 'foo@bar.com',
        link: 'http://localhost:8080/invitation/123456789'
      }
    };

    var confirmation = require('../../../../../backend/core/email/system/signupConfirmation');
    confirmation(invitation, function(err, response) {
      expect(err).to.not.exist;
      var file = path.resolve(tmp + '/' + response.messageId + '.eml');
      expect(fs.existsSync(file)).to.be.true;
      var MailParser = require('mailparser').MailParser;
      var mailparser = new MailParser();
      mailparser.on('end', function(mail_object) {
        expect(mail_object.html).to.be.not.null;
        console.log(mail_object.html);
        done();
      });
      fs.createReadStream(file).pipe(mailparser);
    });
  });
});
