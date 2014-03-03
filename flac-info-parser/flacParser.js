var inherits = require('util').inherits
  , Tokenizr = require('../tokenStream')
  , VorbisStream = require('./vorbisParser')
  , binary = require('../binaryHelpers')
  , _ = require('lodash')
  , debug = require('debuglog')('flacparser');


module.exports = FlacParser;

inherits(FlacParser, Tokenizr);

function FlacParser(){
    if ( !(this instanceof FlacParser) ) 
        return new FlacParser();

    Tokenizr.call(this, { objectMode: true })
    this.container = {};

    this.isEqual(new Buffer('fLaC'), 'not a valid flac file')
        .loop(function(end){
            this.readBuffer(4, this.parseBlockHeader)
                .tap(this.parseBlock)
                .tap(function(tok){
                    if ( tok.header.isLast ) {
                        this.push({ type: 'bytesToFirstFrame', value: this.bytesRead })
                        end()
                    }
                })
        })
    
}

FlacParser.prototype.parseBlockHeader = function(buf){
    var flag = binary.getBit(buf, 0, 7)
        header = {
            isLast: flag,
            type:   BLOCK_TYPES[buf[0] ^ (flag  ? 128 : 0)], // clear last bit
            length: binary.readUInt24BE(buf, 1)
        }

    this.tokens.header = header;
}

FlacParser.prototype.parseBlock = function(tok){
    var type = TYPES[tok.header.type]

    if ( type === TYPES.STREAMINFO )
        this.readBuffer(tok.header.length, this.parseFlacProps )
    else if ( type === TYPES.VORBIS_COMMENT )
        this.readBuffer(tok.header.length, this.parseVorbisComments )
    else if ( type === TYPES.PICTURE )
        this.readBuffer(tok.header.length, VorbisStream.parsePicture )
    else 
        this.skip(tok.header.length)
            
}

FlacParser.prototype.parseFlacProps = function(buf){ 
    
    this.push({ type: 'minBlockSize',    value: buf.readUInt16BE(0) })
    this.push({ type: 'maxBlockSize',    value: buf.readUInt16BE(2) })
    this.push({ type: 'minFrameSize',    value: binary.readUInt24BE(buf, 4) })
    this.push({ type: 'maxFrameSize',    value: binary.readUInt24BE(buf, 7) })
    this.push({ type: 'sampleRate',      value: binary.readUInt24BE(buf, 10) >> 4 })
    this.push({ type: 'channels',        value: (buf[12] >> 1) & 0x7 }) 
    this.push({ type: 'bitsPerSample',   value: (buf.readUInt16BE(12) >> 4 ) & 0xF }) //first 4 bits of byte 2
    this.push({ type: 'samplesInStream', value: buf.readUInt32BE(15) })

    if ( ( buf[13] & 0xF ) !== 0 ) 
        debug('samplesInStream number is larger than 32bits, i\'m to lazy to do that math')
}

//i'd like to once again thank taglib for guidance on parsing these correctly...
FlacParser.prototype.parseVorbisComments = function(buf){
    var header = new Buffer([0x3, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73]) //0x3 + "vorbis"
      , vorbis = new VorbisStream({ flaggingBit: false })

    vorbis.on('data', this.push.bind(this))
    vorbis.end( Buffer.concat([ header, buf ], 7 + buf.length) )
}

var BLOCK_TYPES = {
        0: 'STREAMINFO',
        1: 'PADDING',
        2: 'APPLICATION',
        3: 'SEEKTABLE',
        4: 'VORBIS_COMMENT',
        5: 'CUESHEET',
        6: 'PICTURE',
        127: 'invalid'
    }
  , TYPES = _.invert(BLOCK_TYPES)


