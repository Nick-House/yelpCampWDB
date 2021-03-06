var express     = require("express");
var router      = express.Router();
var passport    = require("passport");
var User        = require("../models/user");
var middleware  = require("../middleware");
var Campground  = require("../models/campground");
var async       = require("async");
var nodemailer  = require("nodemailer");
var crypto      = require("crypto");

require('dotenv').config({path: "../DotEnv/main.env"});

// Register form
router.get("/register", function(req, res) {
    res.render("users/register", {page: 'register'});
});
// Handle sign up logic
router.post("/register", function(req, res) {
    var newUser = new User({
        username: req.body.username,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        about: req.body.about,
        avatar: req.body.avatar
        });
    if(req.body.adminCode === process.env.secretCode) {
        newUser.isAdmin = true;
    }
    User.register(newUser, req.body.password, function(err, user) {
        if(err) {
            console.log(err);
            return res.render("users/register", {error: err.message});
        }
        passport.authenticate("local")(req, res, function() {
            req.flash("success", "Welcome to YelpCamp " + user.username);
            res.redirect("/campgrounds");
        });
    });
});
// Login form 
router.get("/login", function(req, res) {
    res.render("users/login", {page: 'login'});
});
// Handle login logic
router.post("/login", passport.authenticate("local", 
    {
        successRedirect: "/campgrounds", 
        failureRedirect: "/login",
        failureFlash: true,
        successFlash: 'Welcome back to YelpCamp!'
    }), function(req, res) {
});
// Logout route
router.get("/logout", function(req, res) {
    req.logout();
    req.flash("success", "Logged you out!");
    res.redirect("/campgrounds");
});
// User Profiles
router.get("/users/:id", function(req, res) {
  console.log('entered id: ' + req.params.id)
    User.findById(req.params.id, function(err, foundUser) {
        if(err) {
            console.log('user not found for id: ' + req.params.id)
            req.flash("error", "User not found");
            return res.redirect("back");
            
        }
        console.log('found user ' + req.params.id)
        if (!foundUser.username || foundUser === null) {
          console.log('user not found for id: ' + req.params.id)
            req.flash("error", "User not found");
            return res.redirect("back");
        }
        Campground.find().where('author.id').equals(foundUser._id).exec(function(err, campgrounds) {
            if(err) {
                req.flash("error", "Something went wrong");
                res.redirect("back");
            }
            res.render("users/show", {user: foundUser, campgrounds: campgrounds});
        });
    } );
});
// Edit user route
router.get("/users/:id/edit", middleware.checkAccountOwnership, function(req, res) {
    User.findById(req.params.id, function(err, foundUser) {
        if(err) {
            req.flash("error", "Something went wrong");
            res.redirect("/");
        } else {
            res.render("users/edit", {user: foundUser});
        }
        });
    });
// Update user info
router.put("/users/:id", middleware.checkAccountOwnership, function(req, res) {
    // Find and update the correct user 
    User.findByIdAndUpdate(req.params.id, req.body.user, function(err, updatedUser) {
        if(err) {
            req.flash("error", "Update not completed");
            res.redirect("/users/:id");
        } else {
           // Redirect somewhere(show page) 
           res.redirect("/users/" + req.params.id);
        }
    });
});
// forgot password
router.get('/forgot', function(req, res) {
  res.render('users/forgot');
});

router.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/users/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            type: 'OAuth2',
            user: local_settings.my_gmail_username,
            clientId: local_settings.my_oauth_client_id,
            clientSecret: local_settings.my_oauth_client_secret,
            refreshToken: local_settings.my_oauth_refresh_token,
            accessToken: local_settings.my_oauth_access_token
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'yelpcampreset@gmail.com',
        subject: 'YelpCamp Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        console.log('mail sent');
        req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('users/forgot');
  });
});

router.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/users/forgot');
    }
    res.render('users/reset', {token: req.params.token});
  });
});

router.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if(req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, function(err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          });
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect('back');
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            type: 'OAuth2',
            user: local_settings.my_gmail_username,
            clientId: local_settings.my_oauth_client_id,
            clientSecret: local_settings.my_oauth_client_secret,
            refreshToken: local_settings.my_oauth_refresh_token,
            accessToken: local_settings.my_oauth_access_token
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'yelpcampreset@gmail.com',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/campgrounds');
  });
});
router.delete("/users/:id", middleware.checkAccountOwnership, function(req, res) {
    User.findByIdAndRemove(req.params.id, function(err) {
      if(err) {
        res.redirect("/campgrounds");
      } else {
        res.redirect("/campgrounds");
      }
  });
});

module.exports = router;
