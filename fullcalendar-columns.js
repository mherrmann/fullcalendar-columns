/*!
 * fullcalendar-columns v1.0
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
			var origHeadCellHtml = this.timeGrid.headCellHtml;
			var that = this;
			if (! this.timeGrid.headCellHtml)
				throw "This version of fullcalendar-columns doesn't seem to " +
					"be compatible with your FullCalendar version.";
			this.timeGrid.headCellHtml = function(cell) {
				/* Only render one header, with colspan=numColumns: */
				if (cell.col % that.numColumns)
					return '';
				var html = origHeadCellHtml.apply(this, arguments);
				return $(html).attr('colSpan', that.numColumns)[0].outerHTML;
			};
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
			var result =
				AgendaView.prototype.computeRange.apply(this, arguments);
			result.intervalEnd = result.intervalStart.clone().add(1, 'day');
			return result;
		},
		initHiddenDays: function() {
			// We don't want any hidden days such as weekends because it would
			// screw up the display of "border days". For example: With 2
			// columns, a Friday is displayed as two "fake" days: Friday and
			// Saturday, where Saturday corresponds to the second column of
			// Friday. If Saturday were hidden, this would not work.
			this.isHiddenDayHash =
				[false, false, false, false, false, false, false];
		},
		computeNextDate: function(date) {
			// Each day is represented by numColumns "fake" days. Pressing next
			// would therefore normally cause FullCalendar to jump numColumns
			// days into the future. However, we only want it to jump 1 (real)
			// day:
			return this.massageCurrentDate(
				date.clone().startOf(this.intervalUnit).add(1, 'day')
			);
		},
		computePrevDate: function(date) {
			// Similarly to computeNextDate(date).
			return this.massageCurrentDate(
				date.clone().startOf(this.intervalUnit).subtract(1, 'day'), -1
			);
		},
		massageCurrentDate: function(date, direction) {
			// FullCalendar uses this method to skip over hidden days. We do
			// want this to work when paginating forward, to skip over weekends.
			// However, since initHiddenDays() above sets the hidden days to [],
			// no skipping would take place. We thus temporarily set the hidden
			// days back to what FullCalendar would normally set them to be, to
			// be able to mimic the original calculation.
			var isHiddenDayHashBefore = this.isHiddenDayHash;
			AgendaView.prototype.initHiddenDays.call(this);
			if (this.isHiddenDay(date)) {
				date = this.skipHiddenDays(date, direction);
				date.startOf('day');
			}
			this.isHiddenDayHash = isHiddenDayHashBefore;
			return date;
		},
		_computeFakeEvent: function (event) {
			var start = this.calendar.moment(event.start);
			if (start >= this.start) {
				var daysDelta =
					moment.duration(event.start - this.start).days();
				var fakeDayOffset = daysDelta * this.numColumns + event.column;
				var fakeDelta = moment.duration(fakeDayOffset, 'days');
				return $.extend({}, event, {
					start: start.add(fakeDelta),
					end: this.calendar.moment(event.end).add(fakeDelta)
				});
			}
			return event;
		},
		_computeOriginalEvent: function(event) {
			var result = $.extend({}, event);
			var start = this.calendar.moment(event.start);
			if (start >= this.start) {
				var fakeDayOffset = moment.duration(start - this.start).days();
				result.column = fakeDayOffset % this.numColumns;
				var daysDelta =
					fakeDayOffset - Math.floor(fakeDayOffset / this.numColumns);
				result.start = start.subtract(daysDelta, 'days');
				if ('end' in result)
					result.end = this.calendar
						.moment(result.end).subtract(daysDelta, 'days');
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