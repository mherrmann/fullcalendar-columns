# fullcalendar-columns
A FullCalendar extension that adds support for multiple columns (/resources) per day. Tested with FullCalendar v2.3.1 but *not compatible with FullCalendar >= 2.5*. It is recommended that for these higher versions you use the ["vertical resource view" of the official Scheduler plugin](http://fullcalendar.io/js/fullcalendar-scheduler-1.2.1/demos/vertical-resource-view.html).

## Live demo

http://jsfiddle.net/jkmda709/25/

## Usage

Include after `fullcalendar.js`:

    <script type="text/javascript" src="fullcalendar.js">
    <script type="text/javascript" src="fullcalendar-columns.js">

In your FullCalendar `options` dictionary, define a view of type `multiColAgenda`. Set `numColumns` to the number of columns you want displayed. You can optionally specify the `columnHeaders` parameter if you want a label to be displayed at the top of each column:

    $("#calendar").fullCalendar({
        views: {
            multiColAgendaDay: {
                type: 'multiColAgenda',
                duration: { days: 1 },
                numColumns: 2,
                columnHeaders: ['First column', 'Second column']
            }
        },
        defaultView: 'multiColAgendaDay'
    });

From then on, each FullCalendar Event Object can have a `column` attribute, which specifies which column of a day the event belongs to. For example, using FullCalendar's `events` option:

    events: [{
        title: 'Some event',
        start: moment(), // now
        end: moment().add(1, 'hour'), // in 1 hour
        column: 1
    }]

This defines an event in the second column of the current day.

## Advantages
Unlike other similar solutions, this is *not* a fork of FullCalendar. This has the advantage that you can use it with newer versions of FullCalendar, and do not have to depend on a probably unmaintained clone.

## Caveats
The implementation works by tricking FullCalendar into displaying columns as separate days. For example: A Friday with two columns is rendered behind the scenes by asking FullCalendar to draw two days, Friday and the coming Monday, where Monday corresponds to Friday's second column. Care is taken to make this trick transparent to the user (you), but in some cases this is not 100% possible. For example, some [View Object](http://fullcalendar.io/docs/views/View_Object) properties such as `end` do not contain the "correct" value.

## Maintenance
This repository captures the state of code which I use in production and currently does not include features which I do not need. However, I am open to feature or pull requests.