/*!
 * fullcalendar-columns v1.2
 * Docs & License: https://github.com/mherrmann/fullcalendar-columns
 * (c) 2015 Michael Herrmann
 */

(function($, moment) {
	var fc = $.fullCalendar;
	var AgendaView = fc.views.agenda;
	fc.views.multiColAgenda = AgendaView.extend({
		originalEvents: null,
		fakeEvents: null,
		initialize: function() {
			this.numColumns = this.opt('numColumns');
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
				|| name == 'eventDestroy' || name == 'eventClick')
				args[2] = this.originalEvents[args[2]._id];
			else if (name == 'dayClick' || name == 'dayRightclick') {
				var date = this._computeOriginalEvent({ start: args[2] });
				args[2] = date.start;
				args[2].column = date.column;
			}
			return AgendaView.prototype.trigger.apply(this, args);
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
			var daysAvailable =
				this._countNonHiddenDaysBetween(result.start, result.end);
			var daysRequired = daysAvailable * this.numColumns;
			result.end =
				this._addNonHiddenDays(result.start.clone(), daysRequired);
			return result;
		},
		_monkeyPatchGridRendering: function() {
			var that = this;
			var origHeadCellHtml = this.timeGrid.headCellHtml;
			this.timeGrid.headCellHtml = function(cell) {
				/* Only render one header, with colspan=numColumns: */
				if (cell.col % that.numColumns)
					return '';
				var cellOrig = that._computeOriginalEvent(cell);
				var html = origHeadCellHtml.call(this, cellOrig);
				return $(html).attr('colSpan', that.numColumns)[0].outerHTML;
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
				var daysDelta =
					moment.duration(event.start - this.start).days();
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
				var daysDelta = moment.duration(start - this.start).days();
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