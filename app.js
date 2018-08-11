var express         = require("express"),
    app             = express(),
    bodyParser      = require("body-parser"),
    mongoose        = require("mongoose"),
    flash           = require("connect-flash"),
    passport        = require("passport"),
    localStrategy   = require("passport-local"),
    methodOverride  = require("method-override"),
    Campground      = require("./models/campground"),
    Comment         = require("./models/comment"),
    User            = require("./models/user"),
    seedDB          = require("./seeds");
// Requiring Routes
var commentRoutes       = require("./routes/comments"),
    campgroundRoutes    = require("./routes/campgrounds"),
    indexRoutes         = require("./routes/index"),
    userRoutes          = require("./routes/users");

mongoose.connect("mongodb://localhost:27017/yelpCampv14_2");
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public")); // Telling app to use the public dir
app.use(methodOverride("_method"));
app.use(flash());
app.locals.moment = require("moment");

// seedDB(); // seed the database with sample data

// PASSPORT CONFIG //
app.use(require("express-session")({
    secret: "Once again, Leo wins cutest cat!",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next) {
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});

// Using routes
app.use("/", indexRoutes);
app.use("/campgrounds", campgroundRoutes); // /campgrounds prefix
app.use("/campgrounds/:id/comments", commentRoutes); 
app.use("/", userRoutes);

app.listen(process.env.PORT, process.env.IP, function() {
    console.log("The YelpCamp Server Has Started!", `Listening on port ${process.env.PORT}`);
});
