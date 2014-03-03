var util = require("util")
  , _ = require('lodash');

var parsers = {};


addParserAlias(parsers, ['taggingTime', 'date'], function (val) {
    return new Date(val);
})


addParserAlias(parsers, ['genre'], function (val) {
    var arr = []
      , parens = /\((.*?)\)/g;

    if( typeof val === 'number' ) return [ GENRES[val] ];
    
    arr = val.trim().split(/,|\//);

    arr = _.map(arr, function(i) {
       return _(i.split(parens))
            .filter()
            .map(function(i){return parseInt(i, 10) ? GENRES[~~i] : i;})
            .value();
    })

    return _.uniq(_.flatten(arr));
})


addParserAlias(parsers, ['year'], function (val) {
    return isNaN(val) 
        ? parsers.date(val).getFullYear() 
        : ~~val
})

addParserAlias(parsers, ['artist', 'composer'], function (val) {
    return val.split('/');
})

addParserAlias(parsers, ['track', 'disk'], function (val) {
    //if ( !_.isString(val) ) 
    //    debugger;
    var s = /of/i.test(val) ? /of/i : '/'
      , split = val.toString().split(s);

    return { 
        no: parseInt(split[0], 10) || 0, 
        of: parseInt(split[1], 10) || 0
    }
})


exports.parseValue = function(alias, value){
    var comp = COMPLIMENTS[alias]
      , parser = parsers[comp ? comp.parser : alias ] 

    if ( !parser ) return value
    
    return parser(comp ? comp.pre(value) : value);  
}

exports.getAlias = function(key){
    for (var i = 0; i < MAPPINGS.length; i++) {
        for (var j = 0; j < MAPPINGS[i].length; j++) {
            if (MAPPINGS[i][j].toUpperCase() === key.toUpperCase()) 
                return MAPPINGS[i][0];
        }
    }
}

exports.camelize = function(str){
    var str = str.trim().replace(/[-_\s]+(.)?/g, function(match, c){ 
        return c ? c.toUpperCase() : ""; }
    );

    return str.charAt(0).toLowerCase() + str.substring(1)
}

exports.parsers = parsers;

var COMPLIMENTS = {
    'TRACKTOTAL': { 
        parser: "track", 
        pre: function(val){ return "/" + val; } 
    },   
    'DISCTOTAL': { 
        parser: "disk", 
        pre: function(val){ return "/" + val; } 
    },   
}

var GENRES = [ "Blues", "Classic Rock", "Country", "Dance", "Disco", "Funk", "Grunge", "Hip-Hop", "Jazz",
    "Metal", "New Age", "Oldies", "Other", "Pop", "R&B", "Rap", "Reggae", "Rock", "Techno", "Industrial",
    "Alternative", "Ska", "Death Metal", "Pranks", "Soundtrack", "Euro-Techno", "Ambient", "Trip-Hop",
    "Vocal", "Jazz+Funk", "Fusion", "Trance", "Classical", "Instrumental", "Acid", "House", "Game", "Sound Clip",
    "Gospel", "Noise", "AlternRock", "Bass", "Soul", "Punk", "Space", "Meditative", "Instrumental Pop",
    "Instrumental Rock", "Ethnic", "Gothic", "Darkwave", "Techno-Industrial", "Electronic", "Pop-Folk",
    "Eurodance", "Dream", "Southern Rock", "Comedy", "Cult", "Gangsta", "Top 40", "Christian Rap", "Pop/Funk",
    "Jungle", "Native American", "Cabaret", "New Wave", "Psychadelic", "Rave", "Showtunes", "Trailer",
    "Lo-Fi", "Tribal", "Acid Punk", "Acid Jazz", "Polka", "Retro", "Musical", "Rock & Roll", "Hard Rock",
    "Folk", "Folk-Rock", "National Folk", "Swing", "Fast Fusion", "Bebob", "Latin", "Revival", "Celtic",
    "Bluegrass", "Avantgarde", "Gothic Rock", "Progressive Rock", "Psychedelic Rock", "Symphonic Rock",
    "Slow Rock", "Big Band", "Chorus", "Easy Listening", "Acoustic", "Humour", "Speech", "Chanson", "Opera",
    "Chamber Music", "Sonata", "Symphony", "Booty Bass", "Primus", "Porn Groove", "Satire", "Slow Jam", "Club",
    "Tango", "Samba", "Folklore", "Ballad", "Power Ballad", "Rhythmic Soul", "Freestyle", "Duet", "Punk Rock",
    "Drum Solo", "A capella", "Euro-House", "Dance Hall", "Goa", "Drum & Bass", "Club-House", "Hardcore",
    "Terror", "Indie", "BritPop", "Negerpunk", "Polsk Punk", "Beat", "Christian Gangsta Rap", "Heavy Metal",
    "Black Metal", "Crossover", "Contemporary Christian", "Christian Rock", "Merengue", "Salsa", "Thrash Metal",
    "Anime", "JPop", "Synthpop" ];

var MAPPINGS = [
  ['title', 'TIT2', 'TT2', '©nam', 'TITLE', 'Title'],
  ['artist', 'TPE1', 'TP1', '©ART', 'ARTIST', 'Author', 'ORIGARTIST', 'TOPE', 'TPE2'],
  ['albumArtist', 'TPE2', 'TP2', 'aART', 'ALBUMARTIST', 'ENSEMBLE', 'WM/AlbumArtist'],
  ['album', 'TALB', 'TAL', '©alb', 'ALBUM', 'WM/AlbumTitle'],
  ['track', 'TRCK', 'TRK', 'trkn', 'TRACKNUMBER', 'Track', 'WM/TrackNumber'],
  ['disk', 'TPOS', 'TPA', 'disk', 'DISCNUMBER', 'Disk', 'Disc'],
  ['comment', 'COMM', 'COM', '©cmt', 'COMMENT'],
  ['year', 'TDRC', 'TYER', 'TYE', '©day', 'DATE', 'Year', 'WM/Year'],
  ['genre', 'TCON', 'TCO', '©gen', 'gnre', 'GENRE', 'WM/Genre'],
  ['picture', 'APIC', 'PIC', 'covr', 'METADATA_BLOCK_PICTURE', 'Cover Art (Front)', 'Cover Art (Back)'],
  ['composer', 'TCOM', 'TCM', '©wrt', 'COMPOSER'],
  ['duration', '©dur']
];

function addParserAlias(obj, arr, fn){
    _.each(arr, function(name){
        obj[name] = fn    
    })    
}

