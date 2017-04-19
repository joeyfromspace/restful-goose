const gulp = require('gulp');
const spawn = require('child_process').spawn;
const argv = require('yargs').argv;
const jsdoc = require('gulp-jsdoc3');
const bump = require('gulp-bump');
const gmocha = require('gulp-mocha');
const gutil = require('gulp-util');
const istanbul = require('gulp-istanbul');
const del = require('del');
const version = require('gulp-version-number');
const fs = require('fs');
const os = require('os');

let OLD_VERSION = require('./package.json').version;

const abort = function (err) {
    gutil.log('There was an error in the build. Publish aborted.');
    gutil.log(err);
    // Revert package.json to old version
    let pkg = JSON.parse(fs.readFileSync('./package.json'));
    pkg.version = OLD_VERSION;
    fs.writeFileSync('./package.json', JSON.stringify(pkg, null, '\t'), { encoding: 'utf8' });
    process.exit(1);
};

gulp.task('publish', ['version'], function () {
    let exec = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
    let run = spawn(exec, ['publish'], { stdio: 'inherit' });
    
    run.on('close', function () {
        process.exit(0);
    });

    run.on('error', abort);
});

gulp.task('bump', ['test'], function () {
    var releaseType = argv.type || 'patch';
    return gulp.src('./package.json')
        .pipe(bump({ type: releaseType }))
        .pipe(gulp.dest('./'));
});

gulp.task('pre-test', ['clean'], function () {
  return gulp.src(['./lib/**/*.js'])
    .pipe(istanbul())
    .pipe(istanbul.hookRequire());
});

gulp.task('doc', ['bump'], function (done) {
    gulp.src(['README.md', './lib/**/*.js'], {read: false})
        .pipe(jsdoc(done));
});

gulp.task('version', ['doc'], function (done) {
    const ver = require('./package.json').version;
    return gulp.src('./docs/gen/**/*.html')
        .pipe(version({ value: ver, replaces: ['${VERSION}'] }))
        .pipe(gulp.dest('./docs/gen'));
});

gulp.task('clean', function () {
  return del(['./coverage/**/*','docs/**/*']);
});

gulp.task('test', ['pre-test'], function () {
    return gulp.src('./test/**/*.js', { read: false })
        .pipe(gmocha({ timeout: 10000 }))
        .once('error', abort)
        .pipe(istanbul.writeReports())
        .pipe(istanbul.enforceThresholds({ thresholds: { statements: 80 } }))
        .once('error', abort);
});