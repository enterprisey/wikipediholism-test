/* jshint moz: true */
$( document ).ready( function () {
    const API_ROOT = "https://en.wikipedia.org/w/api.php",
          API_SUFFIX = "&format=json&callback=?&continue=",
          TEST_PAGE = "Wikipedia:Wikipediholism test";

    var score = 0;
    var revision = "0";
    var scoreTable = {};

    var url = API_ROOT + "?action=query&prop=revisions&rvprop=content|ids&" +
        "format=jsonfm&titles=" + TEST_PAGE + API_SUFFIX;
    $.getJSON( url, function ( data ) {
        var pageId = Object.getOwnPropertyNames( data.query.pages )[0];
        if ( data.query.pages[ pageId ].hasOwnProperty( "missing" ) ) {
            $( "#test" ).append( $( "<div>" )
                                 .addClass( "errorbox" )
                                 .text( "Mysteriously, I couldn't find the test at " + TEST_PAGE ) );
            return;
        }
        revision = data.query.pages[ pageId ].revisions[ 0 ].revid;
        var pageText = data.query.pages[ pageId ].revisions[ 0 ][ "*" ]
            .replace( /{{[\s\S]+?}}/g, "" );
        var questions = pageText.match( /==The test==[\s\S]+==Interpreting your score==/ )[ 0 ]
            .replace( /==The test==/, "" ).replace( /==Interpreting your score==/, "" )
            .match( /\n#.+?\s*\(-?\d+.*?\)/g );
        $( "#loaded" ).text( "I just loaded " + questions.length + " questions. Let's go!" );

        // Initialize the "Interpret your score" table
        var scoreLines = pageText.match( /==Interpreting your score==[\s\S]+==Bonus questions==/ )[ 0 ]
            .replace( /==Interpreting your score==/, "" ).replace( /==Bonus questions==/, "" )
            .match( /\|\s*\d+\s*(?:–|-)\s*\d+ \|\| [\S ]+/g );
        scoreLines.forEach( function ( line ) {
            var score = parseInt( line.match( /\d+/g )[1] ) + 1;
            var text = line.replace( /\|[\s\S]+?\|\|/, "" );
            scoreTable[ score ] = sanitizeWikitext( text );
        } );

        // Display the score and refresh button
        $( "#test" )
            .append( $( "<div>" ).addClass( "score" ).text( "Current score: 0" ) )
            .append( $( "<button>" )
                     .addClass( "mw-ui-button mw-ui-destructive mw-ui-quiet" )
                     .text( "Reset" )
                     .click( function () {
                         $( ".mw-ui-checkbox" ).prop( "checked", false );
                         score = 0;
                         updateScore( 0, false ); // trigger refresh
                     } ) );

	var table = $( "<table>" ).appendTo( "#test" );

        // Parse the questions into a list of lists
        function parseQuestion( fullText ) {

            // Preprocessing, including a crappy subset of the MW parser
            var text = sanitizeWikitext( fullText )
                .replace( /\n#/, "" )
                .replace( /\(-?\d[\s\S]*?\)/, "" )
                .replace( /^\.+/, "" )
                .trim();

            var value = parseInt( fullText.match( /\(-?\d+/ )[0].replace( /\(/, "" ) );
            if( value === NaN ) value = 0;

            // Each "..." at the beginning bumps the level by one
            var level = Math.floor( fullText.replace( /\n#/, "" ).search( /[^\.]/ ) / 3 );

            return [text, value, level];
        }

        function questionToRow( question, questionIndex ) {
            var text = question[ 0 ];
            var val = question[ 1 ];

            var label = document.createElement( "label" );
            label.setAttribute( "for", questionIndex );
            label.innerHTML = text + " <small>(" + val + "&nbsp;point" +
                ( val == 1 ? "" : "s" ) + ")</small>";
            var labelCell = document.createElement( "td" );
            labelCell.appendChild( label );

            var row = document.createElement( "tr" );
            row.innerHTML = "<td><input type='checkbox' value='" + val +
                "' class='mw-ui-checkbox' id='" + questionIndex + "' /></td>";
            row.appendChild( labelCell );

            return row;
        }

        var questionIndex = 0;
        function makeQuestionsTable( currLevel ) {
            var table = document.createElement( "table" );
            for( ; questionIndex < questions.length; questionIndex++ ) {
                var currQuestion = parseQuestion( questions[ questionIndex ] );
                if( currQuestion[ 2 ] > currLevel ) {
                    var newRow = document.createElement( "tr" );
                    newRow.innerHTML = "<td></td>";
                    newRow.appendChild( makeQuestionsTable( currLevel + 1 ) );
                    table.appendChild( newRow );
                } else if( currQuestion[ 2 ] < currLevel ) {
                    questionIndex--;
                    return table;
                } else {
                    table.appendChild( questionToRow( currQuestion.slice( 0, 2 ), questionIndex ) );
                }
            }
            return table;
        };

        // Actually create and display the table
        document.getElementById( "test" ).appendChild( makeQuestionsTable( 0 ) );

        // Add event listeners
        var allCheckboxes = document.getElementsByTagName( "input" );
        for( var i = 0; i < allCheckboxes.length; i++ ) {
            allCheckboxes[ i ].onclick = function () { updateScore( parseInt( this.value ), this.checked ); };
        }

        // Add another reset button, on the bottom
        $( "#test" )
            .append( $( "<button>" )
                     .addClass( "mw-ui-button mw-ui-destructive" )
                     .text( "Reset score" )
                     .click( function () {
                         $( ".mw-ui-checkbox" ).prop( "checked", false );
                         score = 0;
                         updateScore( 0, false ); // trigger refresh
                     } ) );

        // Refresh the score displays
        updateScore( 0, false );
    } );

    function updateScore( questionScore, checked ) {
        if ( checked ) {
            score += questionScore;
        } else {
            score -= questionScore;
        }
        $( ".score" ).text( "Current score: " + score );

        for ( cutoffScore in scoreTable ) {
            if ( score < cutoffScore ) {
                document.getElementById( "diagnosis" ).innerHTML = "<a h" +
                    "ref='https://en.wikipedia.org/wiki/Wikipedia:Wikipediho" +
                    "lism_test#Interpreting_your_score'>Diagnosis</a>: " +
                    scoreTable[ cutoffScore ];
                break;
            }
        }

        document.getElementById( "description" ).innerHTML = "Your score was " +
            score + " point" + ( score == 1 ? "" : "s" ) + "! You can display" +
            " your score on your <a href='https://en.wikipedia.org/wiki/Speci" +
            "al:MyPage'>user page</a> with this code for a userbox: <tt>{{Use" +
            "r&nbsp;Wikipediholic|" + score + "|" + revision + "}}</tt>.";
    };

    // Makes wikitext into HTML (sorta).
    function sanitizeWikitext( wikitext ) {
        return wikitext
            .replace( /\[\[([\s\S]+?\|)?/g, "" ).replace( /\]\]/g, "" )
            .replace( /'''([^']+)'''/g, "<b>$1</b>" );
    }
} );
