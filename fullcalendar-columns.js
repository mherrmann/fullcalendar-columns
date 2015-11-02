/*
 * fullcalendar-columns v1.5
 * Docs & License: https://github.com/mherrmann/fullcalendar-columns
 * (c) 2015 Michael Herrmann
 */

(function($, moment) {
	var fc = $.fullCalendar;
	var AgendaView = fc.views.agenda.class || fc.views.agenda;
	fc.views.multiColAgenda = AgendaView.extend({
		originalEvents: null,
		fakeEvents: null,
		initialize: function() {
			this.columns = this.opt('columns') || [{}];
			this.numColumns = this.columns.length || 1;
			AgendaView.prototype.initialize.call(this);
			this._monkeyPatchGridRendering();
		},
		renderEvents: function(events) {
			this.originalEvents = {};
			this.fakeEvents = [];
			for (var i = 0; i < events.length; i++) {
				var event = events[i];
				this.originalEvents[event._id] = event;
				this.fakeEvents.push(this._computeFakeEvent(event));
			}
			return AgendaView.prototype.renderEvents.call(
				this, this.fakeEvents
			);
		},
		trigger: function(name, thisObj) {
			var args = Array.prototype.slice.call(arguments);
			if (name == 'eventRender' || name == 'eventAfterRender'
				|| name == 'eventDestroy' || name == 'eventClick'
				|| name == 'eventMouseover' || name == 'eventMouseout')
				args[2] = this.originalEvents[args[2]._id];
			else if (name == 'dayClick' || name == 'dayRightclick') {
				var date = this._computeOriginalEvent({ start: args[2] });
				args[2] = date.start;
				args[2].column = date.column;
				args[2].columnData = date.columnData;
			}
			return AgendaView.prototype.trigger.apply(this, args);
		},
		reportSelection: function(range, ev) {
			var event = this._computeOriginalEvent(range);

			this.isSelected = true;
			this.trigger('select', null, event.start, event.end, ev, event);
		},
		reportEventResize: function(event, location, largeUnit, el, ev) {
			return this._reportEventReschedule(
				'reportEventResize', event, location, largeUnit, el, ev
			);
		},
		reportEventDrop: function(event, location, largeUnit, el, ev) {
			return this._reportEventReschedule(
				'reportEventDrop', event, location, largeUnit, el, ev
			);
		},
		updateEvent: function(event) {
			$.extend(
				this._getFakeEvent(event._id), this._computeFakeEvent(event)
			);
		},
		computeRange: function(date) {
			var result = AgendaView.prototype.computeRange.call(this, date);
			result.endOrig = result.end.clone();

			var daysAvailable = this._countNonHiddenDaysBetween(result.start, result.end);
			var daysRequired = daysAvailable * this.numColumns;
			result.end = this._addNonHiddenDays(result.start, daysRequired);
			return result;
		},
		_monkeyPatchGridRendering: function() {
			var that = this;
			var origHeadCellHtml = this.timeGrid.headCellHtml;
			this.timeGrid.headCellHtml = function(cell) {
				/*
				 * Make multiple day header cells (each for one column) appear
				 * as one. The easiest way to do this would be to just render
				 * a single header cell with colspan=this.numColumns. However,
				 * this leads to misalignment between the day header cells and
				 * the events table. To get around this, we do render the same
				 * number of <th> cells as FullCalendar, but only fill the first
				 * one:
				 */
				var cellOrig = that._computeOriginalEvent(cell);
				var $html = $(origHeadCellHtml.call(this, cellOrig));
				var isFirstCellForDay = cellOrig.column == 0;
				var isLastCellForDay = cellOrig.column == that.numColumns - 1;

				var html = '';
				if (isFirstCellForDay) {
					// Make the cell appear centered:
					var posPercent = 100 * that.numColumns;
					html  = '<div style="position: relative; width: '+ posPercent + '%;text-align:center;">' + $html.html() + '</div>';
				} else {
					html = '<div>&nbsp;</div>';
					$html.css('border-left-width', 0);
				}
				if (! isLastCellForDay) {
					$html.css('border-right-width', 0);
				}

				// add labels
				if (cellOrig.columnData) {
					html += '<div class="col-label col-label-' + cellOrig.columnData.id + '">' +
						cellOrig.columnData.name +
						'</div>';
				}

				// set updated html
				$html.html(html);

				return $html[0].outerHTML;
			};

			var origGetDayClasses = this.timeGrid.getDayClasses;
			this.timeGrid.getDayClasses = function(date) {
				var dateCol = that._computeOriginalEvent({ start: date });
				return origGetDayClasses.call(this, dateCol.start);
			};
		},
		_computeFakeEvent: function(event) {
			var result = $.extend({}, event);
			var start = this.calendar.moment(event.start);
			if (start >= this.start) {
				var daysDelta = moment.duration(event.start - this.start).days();
				var fakeDayOffset = daysDelta * this.numColumns + event.column;
				result.start = this._addNonHiddenDays(
					start.subtract(daysDelta, 'days'), fakeDayOffset
				);
				if ('end' in event) {
					var end = this.calendar.moment(event.end);
					result.end = this._addNonHiddenDays(
						end.subtract(daysDelta, 'days'), fakeDayOffset
					);
				}
			}
			return result;
		},
		_addNonHiddenDays: function(date, deltaDays) {
			var result = this.calendar.moment(date);
			for (var i=0; i < deltaDays; i++)
				result = this.skipHiddenDays(result.add(1, 'day'));
			return result;
		},
		_countNonHiddenDaysBetween: function(date1, date2) {
			for (var result=0; date1.isBefore(date2, 'day'); result++)
				date1 = this._addNonHiddenDays(date1, 1);
			return result;
		},
		_computeOriginalEvent: function(event) {
			var result = $.extend({}, event);
			var start = this.calendar.moment(event.start);
			if (start >= this.start) {
				var fakeDayOffset =
					this._countNonHiddenDaysBetween(this.start, start);
				result.column = fakeDayOffset % this.numColumns;
				result.columnData = this.columns[result.column];
				var daysDelta = start.diff(this.start, 'days');
				var days = Math.floor(fakeDayOffset / this.numColumns);
				result.start = this._addNonHiddenDays(
					start.subtract(daysDelta, 'days'), days
				);
				if ('end' in event) {
					var end = this.calendar.moment(event.end);
					result.end = this._addNonHiddenDays(
						end.subtract(daysDelta, 'days'), days
					);
				}
			}
			return result;
		},
		_getFakeEvent: function(_id) {
			for (var i=0; i < this.fakeEvents.length; i++)
				if (this.fakeEvents[i]._id == _id)
					return this.fakeEvents[i];
		},
		_reportEventReschedule: function(
			rescheduleType, fakeEvent, location, largeUnit, el, ev
		) {
			fakeEvent.start = location.start.clone();
			fakeEvent.end = location.end.clone();
			var event = this.originalEvents[fakeEvent._id];
			location = this._computeOriginalEvent(location);
			event.column = location.column;
			event.columnData = location.columnData;
			return AgendaView.prototype[rescheduleType].call(
				this, event, location, largeUnit, el, ev
			);
		}
	});

	var origFullCalendar = $.fn.fullCalendar;
	$.fn.fullCalendar = function(options) {
		if (options == 'updateEvent') { // Required by multiColAgenda
			var view = origFullCalendar.call(this, 'getView');
			if (view.updateEvent)
				view.updateEvent(arguments[1]);
		}
		return origFullCalendar.apply(this, arguments);
	};
})(jQuery, moment);