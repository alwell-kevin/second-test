var base_url = "https://memessaging-gateway.herokuapp.com"
var CONVERSATIONS = {},
    USERS, ACTIVE_USER;

$(document).ready(function() {})

//On Load Functions
function getUsers() {
    return new Promise( /* executor */ function(resolve, reject) {
        $.ajax({
            url: base_url + '/users',
            type: 'GET',
            dataType: 'jsonp',
            success: function(data) {
                resolve(data)
            },
            error: function(err) {
                console.log('Failed!', err);
            }
        });
    })
}

function createUser(userName) {
    return new Promise( /* executor */ function(resolve, reject) {
        $.ajax({
            url: base_url + '/users',
            type: 'POST',
            dataType: 'json',
            data: {
                "username": userName,
                "admin": true
            },
            success: function(data) {
                user = {}
                user.user_jwt = data.user_jwt
                user.name = userName;
                user.id = data.user.id
                resolve(user)
            },
            error: function(err) {
                err = JSON.parse(err);

                console.log('Create User Failed! ', err);
                resolve(err)
            }
        });
    })
}


function getUserJwt(userId) {
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: base_url + '/jwt/' + userId,
            type: 'GET',
            dataType: 'jsonp',
            data: {
                "admin": true
            },
            success: function(data) {
                console.log("JWT Success", data);
                resolve(data)
            },
            error: function(err) {
                console.log('JWT Failed!', err);
                reject(err)
            }
        });
    })
}

function createConversation(displayName) {
    $.ajax({
        url: base_url + '/conversations',
        type: 'POST',
        dataType: 'jsonp',
        data: {
            "displayName": displayName
        },
        success: function(data) {
            console.log("CREATED CONVERSATION: ", data)
            return data
        },
        error: function(err) {
            console.log('Failed!', err);
        }
    });
}


function getConversations() {
    return new Promise( /* executor */ function(resolve, reject) {
        $.ajax({
            url: base_url + '/conversations',
            type: 'GET',
            dataType: 'jsonp',
            success: function(data) {
                console.log("Conversations:", data._embedded.conversations);
                resolve(data)
            },
            error: function(err) {
                console.log('Failed!', err);
            }
        });
    })
}

//Initialize Application
var onLoad = function() {

    //Get Conversations
    CONVERSATIONS = getConversations().then(function(convList) {
        if (convList.count > 0) {
            CONVERSATIONS = convList._embedded.conversations
        } else {
            CONVERSATIONS = createConversation("active-conversation");
        }

        console.log("CONVERSATIONS: ", CONVERSATIONS)
    });

    //Get Users
    getUsers().then(function(userList) {
        USERS = userList;
        if (USERS.length > 0) {
            ACTIVE_USER = userList[0];
            
            //GET ACTIVE USER JWT
            getUserJwt(ACTIVE_USER.name).then(function(jwt) {
                ACTIVE_USER.jwt = jwt;
            })


        } else {
            console.log("NEED TO CREATE USER - No active user.")
        }

        console.log("USERS: ", USERS)
    })

}

onLoad()