/* -*- mode: javascript; tab-width: 2; indent-tabs-mode: nil; -*-
*
* Copyright (c) 2011-2013 Marcus Geelnard
*
* This file is part of SoundBox.
*
* SoundBox is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* SoundBox is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with SoundBox.  If not, see <http://www.gnu.org/licenses/>.
*
*/

"use strict";

var CPlayer = function ()
{
  //Optional trackID for use with multi-tracked output.
  var trackID = 0;
  var mParent = this;
  var mProgressCallback;

  var mGeneratedBuffer;

  var mWorker = new Worker("scripts/core/player-worker.js");

  mWorker.onmessage = function (event) {
    if (event.data.cmd === "progress") {
      mGeneratedBuffer = event.data.buffer;
      if (mProgressCallback) {
        mProgressCallback(event.data.progress, mParent, trackID);
      }
    }
  };


  //--------------------------------------------------------------------------
  // Public methods
  //--------------------------------------------------------------------------

  // Generate the audio data (done in worker).
  this.generate = function(song, opts, progressCallback)
  {
    mProgressCallback = progressCallback;
    mWorker.postMessage({
      cmd: "generate",
      song: song,
      opts: opts
    });
  };

  function int32ToUint8Array(int){
    return new Uint8Array([int & 255, (int >> 8) & 255, (int >> 16) & 255, (int >> 24) & 255]);
  }

  function createWaveHeader(waveWords){
    const headerLen = 44;
    const RIFF = new Uint8Array([82,73,70,70]);
    const WAVE = new Uint8Array([87,65,86,69]);
    //Format Chunk Identifier.
    const fmtI = new Uint8Array([102,109,116,32]);
    //Length of the format data (16 for PCM). 
    const fmtL = 16;
    //PCM use Identifier.
    const PCMI = int32ToUint8Array(0x000001);
    const channels = 2; //Stereo
    const sampleRate = int32ToUint8Array(44100);

    console.log(sampleRate);
    
    
    var fullFileLength = headerLen + (waveWords * channels);
    var fileSize = int32ToUint8Array(fullFileLength - 8);
    var fileSizeNoHeader = int32ToUint8Array(fullFileLength - 44);

    var waveHeader = new Uint8Array(headerLen);
    waveHeader.set(
      [RIFF,
       fileSize,
       WAVE,
       fmtL,
       PCMI,
       0, //Padding for channel specifier.
       channels,
       0,68,172,0,0,16,177,2,0,4,0,16,0,100,97,116,97,
       fileSizeNoHeader]
    );
  }

  // Create a WAVE formatted Uint8Array from the generated audio data.
  this.createWave = function()
  {
    // Turn critical object properties into local variables (performance)
    var mixBuf = mGeneratedBuffer;
    var waveWords = mixBuf.length;
    
    const headerLen = 44;
    var wave = new Uint8Array(headerLen + waveWords * 2);
    wave += createWaveHeader(waveWords);
    // Append actual wave data
    for(var i = 0, idx = headerLen; i < waveWords; ++i){
      // Note: We clamp here
      var y = mixBuf[i];
      y = y < -32767 ? -32767 : (y > 32767 ? 32767 : y);
      wave[idx++] = y & 255;
      wave[idx++] = (y >> 8) & 255;
    }

    // Return the WAVE formatted typed array
    return wave;
  };

  // Get n samples of wave data at time t [s]. Wave data in range [-2,2].
  this.getData = function(t, n)
  {
    var i = 2 * Math.floor(t * 44100);
    var d = new Array(n);
    var b = mGeneratedBuffer;
    for (var j = 0; j < 2*n; j += 1) {
        var k = i + j;
        d[j] = t > 0 && k < b.length ? b[k] / 32768 : 0;
    }
    return d;
  };
};
