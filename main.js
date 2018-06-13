var base_url = "https://messaging-gateway.herokuapp.com"
var ACTIVE_CONVERSATION = {},
    USERS, WEB_ACTIVE_USER, MOBILE_ACTIVE_USER, CONV_CLIENT;

$(document).ready(function () {
    $("#call").click(function () {})
})


//On Load Functions
function getUsers() {
    return new Promise( /* executor */ function (resolve, reject) {
        $.ajax({
            url: base_url + '/users',
            type: 'GET',
            dataType: 'jsonp',
            success: function (data) {
                resolve(data)
            },
            error: function (err) {
                console.log('Failed!', err);
            }
        });
    })
}

function createUser(userName) {
    return new Promise( /* executor */ function (resolve, reject) {
        $.ajax({
            url: base_url + '/users',
            type: 'POST',
            dataType: 'json',
            data: {
                "username": userName,
                "admin": true
            },
            success: function (data) {
                user = {}
                user.user_jwt = data.user_jwt
                user.name = userName;
                user.id = data.user.id
                resolve(user)
            },
            error: function (err) {
                err = JSON.parse(err);

                console.log('Create User Failed! ', err);
                resolve(err)
            }
        });
    })
}


function getUserJwt(userId) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            url: base_url + '/jwt/' + userId,
            type: 'GET',
            dataType: 'jsonp',
            data: {
                "admin": true
            },
            success: function (data) {
                console.log("JWT Success", data);
                resolve(data)
            },
            error: function (err) {
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
        dataType: 'json',
        data: {
            "displayName": displayName
        },
        success: function (data) {
            console.log("CREATED CONVERSATION: ", data)
            return data
        },
        error: function (err) {
            console.log('Failed!', err);
        }
    });
}


function getConversations() {
    return new Promise( /* executor */ function (resolve, reject) {
        $.ajax({
            url: base_url + '/conversations',
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                console.log("Conversations:", data._embedded.conversations);
                resolve(data._embedded.conversations)
            },
            error: function (err) {
                console.log('Failed!', err);
            }
        });
    })
}

function addUserToConversation(activeUser, conversation) {
    return new Promise( /* executor */ function (resolve, reject) {
        $.ajax({
            url: base_url + '/conversationmember',
            type: 'GET',
            dataType: 'jsonp',
            data: {
                conversationId: conversation.uuid,
                userId: activeUser.id,
                action: "join"
            },
            success: function (data) {
                if (data.body && data.body.code === "conversation:error:member-already-joined") {
                    data = {
                        "status": "success"
                    }
                }

                resolve(data)
            },
            error: function (err) {
                console.log('Failed! addUserToConversation', err);
                reject(err);
            }
        });
    })
}

//Initialize Application
var onLoad = function () {
    var mobile_resolved = false;
    var web_resolved = false;

    return new Promise((resolve, reject) => {
        //Get Conversations
        getConversations().then(function (convList) {
            if (convList.length > 0) {
                ACTIVE_CONVERSATION = convList[0]

                //Get Users
                getUsers().then(function (userList) {
                    USERS = userList;
                    if (USERS.length > 2) {
                        WEB_ACTIVE_USER = userList[0];
                        MOBILE_ACTIVE_USER = userList[1];
                        //GET ACTIVE_USER JWT
                        getUserJwt(WEB_ACTIVE_USER.name).then(function (jwt) {
                            WEB_ACTIVE_USER.jwt = jwt;
                            //Add ACTIVE_USER to conversation
                            addUserToConversation(WEB_ACTIVE_USER, ACTIVE_CONVERSATION).then(function (data) {
                                web_resolved = true;
                                console.log("active Web User added to active Conversation", data);

                                if (mobile_resolved) {
                                    //COMPLETE ON-LOAD
                                    resolve()
                                }
                            })
                        })

                        getUserJwt(MOBILE_ACTIVE_USER.name).then(function (jwt) {
                            MOBILE_ACTIVE_USER.jwt = jwt;

                            addUserToConversation(MOBILE_ACTIVE_USER, ACTIVE_CONVERSATION).then(function (data) {
                                mobile_resolved = true;
                                console.log("active MOBILE User added to active Conversation", data);
                                if (web_resolved) {
                                    //COMPLETE ON-LOAD
                                    resolve()
                                }
                            })
                        })


                    } else {
                        createUser("activeUser" + Math.random()).then(function (user) {
                            onLoad();
                        })
                        console.log("NEED TO CREATE USER - No active user.")
                    }

                    console.log("USERS: ", USERS)
                })
            } else {
                ACTIVE_CONVERSATION = createConversation("active-conversation");
            }

            console.log("CONVERSATION: ", ACTIVE_CONVERSATION)
        });
    })
}

class ChatApp {
    constructor() {
        this.audio = document.getElementById('audio')
        this.callPhoneForm = document.getElementById('call-phone-form')
        this.phoneIcon = document.getElementById('phone-icon')
        this.call ={};

        this.setupUserEvents();
        if (window.location.search.includes("launch")) {
            localStorage.setItem("active_user", JSON.stringify(WEB_ACTIVE_USER));
            this.joinConversation(WEB_ACTIVE_USER.jwt.user_jwt);
        } else {
            JSON.parse(localStorage.getItem('active_user'));
            localStorage.setItem("active_user", JSON.stringify(MOBILE_ACTIVE_USER));
            this.joinConversation(MOBILE_ACTIVE_USER.jwt.user_jwt);
        }
    }

    errorLogger(error) {
        console.log(error)
    }

    eventLogger(event) {
        return () => {
            console.log("'%s' event was sent", event)
        }
    }

    authenticate() {
        var user = JSON.parse(localStorage.getItem('active_user'));
        return user.jwt
    }

    setupConversationEvents(conversation) {
        this.conversation = conversation
        console.log('*** Conversation Retrieved', conversation)
        if (conversation.me.state === "JOINED") {
            window.alert("Begin")
        }
    }

    joinConversation(userToken) {
        new ConversationClient({
                debug: false
            })
            .login(userToken)
            .then(app => {
                this.app = app

                this.app.on("call:state:changed", (call) => {
                    this.call = call;

                    console.log("Call State: ", call.state)
                    if (call.state === "started") {
                        this.call = call;
                        this.showCallControls();
                    }
                    if (call.state === "unanswered") {
                        console.log("unanswered")
                        this.call = call;
                    }
                    if (call.state === "rejected") {
                        console.log("completed")
                        this.call = call;
                    }
                })
                return app.getConversation(ACTIVE_CONVERSATION.uuid)
            })
            .then(this.setupConversationEvents.bind(this))
            .catch(this.errorLogger)
    }

    showCallControls() {
        console.log("showCC")
        document.getElementById('phone-icon').src = "./hangup.png"
    }

    hangup() {
        this.call.hangUp();
        this.hideCallControls()
    }

    hideCallControls() {
        console.log("hideCC")
        document.getElementById('phone-icon').src = "./phone.png"
    }

    setupAudioStream(stream) {
        // Older browsers may not have srcObject
        if ("srcObject" in this.audio) {
            this.audio.srcObject = stream;
        } else {
            // Avoid using this in new browsers, as it is going away.
            this.audio.src = window.URL.createObjectURL(stream);
        }

        this.audio.onloadedmetadata = () => {
            this.audio.play();
        }
    }

    setupUserEvents() {
        this.phoneIcon.addEventListener('click', () => {
            if (this.phoneIcon.src.includes("hangup")) {
                this.hangup();
            }

            if (this.phoneIcon.src.includes("phone")) {
                this.app.callPhone(document.getElementById("to-num").value)
            }
        })
    }
}


onLoad().then(function () {
    new ChatApp()
})