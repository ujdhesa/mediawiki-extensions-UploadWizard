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

( function ( mw, uw, $, OO ) {
	/**
	 * Represents the details step in the wizard.
	 *
	 * @class mw.uw.controller.Details
	 * @extends mw.uw.controller.Step
	 * @constructor
	 */
	uw.controller.Details = function UWControllerDetails( config ) {
		uw.controller.Step.call(
			this,
			new uw.ui.Details()
				.connect( this, {
					'start-details': 'startDetails',
					'finalize-details-after-removal': [ 'emit', 'finalize-details-after-removal' ]
				} ),
			config
		);

		this.stepName = 'details';
		this.finishState = 'complete';
	};

	OO.inheritClass( uw.controller.Details, uw.controller.Step );

	/**
	 * Move to this step.
	 *
	 * @param {mw.UploadWizardUpload[]} uploads List of uploads being carried forward.
	 */
	uw.controller.Details.prototype.moveTo = function ( uploads ) {
		var successes = 0;

		$.each( uploads, function ( i, upload ) {
			if ( upload && upload.state !== 'aborted' && upload.state !== 'error' ) {
				successes++;

				if ( successes > 1 ) {
					// Break out of the loop, we have enough.
					return false;
				}
			}
		} );

		$.each( uploads, function ( i, upload ) {
			if ( upload === undefined ) {
				return;
			}

			upload.createDetails();

			if ( upload.fromURL || upload.chosenDeed.name === 'custom' ) {
				upload.details.useCustomDeedChooser();
			}

			// Show toggler to copy selected metadata if there's more than one successful upload
			if ( successes > 1 ) {
				uploads[ 0 ].details.buildAndShowCopyMetadata();
			}
		} );

		uw.controller.Step.prototype.moveTo.call( this, uploads );
	};

	uw.controller.Details.prototype.empty = function () {
		this.ui.empty();
	};

	/**
	 * Start details submit.
	 * TODO move the rest of the logic here from mw.UploadWizard
	 */
	uw.controller.Details.prototype.startDetails = function () {
		var details = this;

		this.valid().done( function () {
			details.ui.hideEndButtons();
			details.submit();
			details.emit( 'start-details' );
		} ).fail( function () {
			details.emit( 'details-error' );
		} );
	};

	/**
	 * Check details for validity.
	 *
	 * @return {jQuery.Promise}
	 */
	uw.controller.Details.prototype.valid = function () {
		var
			validityPromises = [],
			necessary = 0,
			total = 0,
			titles = {};

		$.each( this.uploads, function ( i, upload ) {
			if ( upload === undefined ) {
				return;
			}

			// Update any error/warning messages about all DetailsWidgets
			upload.details.dateDetailsField.checkValidity();

			validityPromises.push( $.when(
				upload.details.dateDetails.getErrors()
				// Other DetailsWidgets errors go here...
			).then( function () {
				var i, title, hasErrors = false;

				for ( i = 0; i < arguments.length; i++ ) {
					if ( arguments[ i ].length ) {
						// One of the DetailsWidgets has errors
						hasErrors = true;
					}
				}

				upload.details.clearDuplicateTitleError();
				// This also updates legacy error messages
				if ( !upload.details.valid() ) {
					hasErrors = true;
				}

				// Seen this title before?
				title = upload.title.getName() + '.' + mw.Title.normalizeExtension( upload.title.getExtension() );
				if ( titles[ title ] ) {
					// Don't submit. Instead, set an error in details step.
					upload.details.setDuplicateTitleError();
					hasErrors = true;
				} else {
					titles[ title ] = true;
				}

				if ( upload.details.necessaryFilled() ) {
					necessary += 1;
				}

				if ( hasErrors ) {
					return $.Deferred().reject();
				}
			} ) );

			total += 1;
		} );

		// If not all uploads are valid, $.when will reject this
		return $.when.apply( $, validityPromises ).then( function () {
			if ( necessary === total ) {
				// All uploads valid, all necessary fields filled
				return $.Deferred().resolve();
			} else {
				// Valid, but recommended fields missing, ask for confirmation
				return this.confirmationDialog();
			}
		}.bind( this ) );
	};

	uw.controller.Details.prototype.confirmationDialog = function () {
		var
			windowManager = new OO.ui.WindowManager(),
			confirmationDialog = new OO.ui.MessageDialog();
		windowManager.addWindows( [ confirmationDialog ] );
		$( 'body' ).append( windowManager.$element );

		return windowManager.openWindow( confirmationDialog, {
			title: mw.message( 'mwe-upwiz-dialog-title' ).text(),
			message: mw.message( 'mwe-upwiz-necessary-confirm' ).text(),
			verbose: true,
			actions: [
				{
					label: mw.message( 'mwe-upwiz-dialog-no' ).text(),
					action: 'reject',
					flags: [ 'safe' ]
				},

				{
					label: mw.message( 'mwe-upwiz-dialog-yes' ).text(),
					action: 'accept',
					flags: [ 'constructive', 'primary' ]
				}
			]
		} ).then( function ( opened ) {
			return opened.then( function ( closing ) {
				return closing.then( function ( data ) {
					if ( data.action === 'accept' ) {
						return $.Deferred().resolve();
					}

					return $.Deferred().reject();
				} );
			} );
		} );
	};

	uw.controller.Details.prototype.canTransition = function ( upload ) {
		return (
			uw.controller.Step.prototype.canTransition.call( this, upload ) &&
			upload.state === 'details'
		);
	};

	uw.controller.Details.prototype.transitionOne = function ( upload ) {
		return upload.details.submit();
	};

	/**
	 * Submit details to the API.
	 *
	 * @return {jQuery.Promise}
	 */
	uw.controller.Details.prototype.submit = function () {
		var details = this;

		$.each( this.uploads, function ( i, upload ) {
			// Skip empty uploads
			if ( upload === undefined ) {
				return;
			}

			// Clear error state
			if ( upload.state === 'error' ) {
				upload.state = 'details';
			}

			// Set details view to have correct title
			upload.details.setVisibleTitle( upload.title.getMain() );
		} );

		// Disable edit interface
		this.ui.disableEdits();

		// Hide errors (maybe this submission fixes them)
		this.ui.hideErrors();

		return this.transitionAll().then( function () {
			details.showErrors();

			if ( details.showNext() ) {
				details.moveFrom();
			}
		} );
	};

	/**
	 * Show errors in the form.
	 * See UI class for more.
	 */
	uw.controller.Details.prototype.showErrors = function () {
		this.ui.showErrors();
	};

}( mediaWiki, mediaWiki.uploadWizard, jQuery, OO ) );
