/*
 * This file is part of the MediaWiki extension UploadWizard.
 *
 * UploadWizard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * UploadWizard is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with UploadWizard.  If not, see <http://www.gnu.org/licenses/>.
 */

( function ( mw, uw ) {
	var EFLP;

	/**
	 * @class uw.EventFlowLogger
	 * Event logging helper for funnel analysis. Should be instantiated at the very beginning; uses internal state
	 * to link events together.
	 * @constructor
	 * @param eventLog mw.eventLog object, for dependency injection
	 */
	function EventFlowLogger( eventLog ) {
		this.eventLog = eventLog;

		/**
		 * A random number identifying this upload session for analytics purposes.
		 * @property {string}
		 */
		this.flowId = parseInt( new Date().getTime() + '' + Math.floor( Math.random() * 1000 ), 10 );
	}
	EFLP = EventFlowLogger.prototype;

	/**
	 * Does the work of logging a step.
	 * @private
	 * @param {'tutorial'|'file'|'deeds'|'details'|'thanks'} step
	 * @param {boolean} [skipped=false]
	 * @param {Object} [extraData] Extra data passed to the log.
	 */
	EFLP.performStepLog = function ( step, skipped, extraData ) {
		var data = extraData || {};

		data.step = step;

		if ( skipped === true ) {
			data.skipped = true;
		}

		this.log( 'UploadWizardStep', data );
	};

	/**
	 * @protected
	 * Logs arbitrary data. This is for internal use, you should call one of the more specific functions.
	 * @param {string} schema EventLogger schema name
	 * @param {object} data event data (without flowId)
	 */
	EFLP.log = function ( schema, data ) {
		if ( !this.eventLog ) {
			return;
		}
		data.flowId = this.flowId;
		this.eventLog.logEvent( schema, data );
	};

	/**
	 * Logs entering into a given step of the upload process.
	 * @param {'tutorial'|'file'|'deeds'|'details'|'thanks'} step
	 * @param {Object} [extraData] Extra data to pass along in the log.
	 */
	EFLP.logStep = function ( step, extraData ) {
		this.performStepLog( step, false, extraData );
	};

	/**
	 * Logs skipping a given step of the upload process.
	 * @param {'tutorial'|'file'|'deeds'|'details'|'thanks'} step
	 */
	EFLP.logSkippedStep = function ( step ) {
		this.performStepLog( step, true );
	};

	/**
	 * Logs an event.
	 * @param {string} name Event name. Recognized names:
	 *  - upload-button-clicked
	 *  - flickr-upload-button-clicked
	 *  - retry-uploads-button-clicked
	 *  - continue-clicked
	 *  - continue-anyway-clicked
	 *  - leave-page
	 */
	EFLP.logEvent = function ( name ) {
		this.log( 'UploadWizardFlowEvent', { event: name } );
	};

	/**
	 * Logs an upload event.
	 * @param {string} name Event name. Recognized names:
	 *  - upload-started
	 *  - upload-succeeded
	 *  - upload-failed
	 *  - upload-removed
	 *  - uploads-added
	 * @param {object} data
	 * @param {integer} data.size file size in bytes (will be anonymized)
	 * @param {integer} data.duration upload duration in seconds
	 * @param {string} data.error upload error string
	 */
	EFLP.logUploadEvent = function ( name, data ) {
		data.event = name;

		if ( 'size' in data ) {
			// anonymize size by rounding to closest number with 1 significant digit
			data.size = parseFloat( Number( data.size ).toPrecision( 1 ), 10 );
		}

		this.log( 'UploadWizardFlowEvent', data );
	};

	uw.EventFlowLogger = EventFlowLogger;
}( mediaWiki, mediaWiki.uploadWizard ) );