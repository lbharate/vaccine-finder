const notifier = require('node-notifier');
const request = require('request');
const schedule = require('node-schedule');

const pincodes = ['411014', '411028', '411036', '411006', '411013', '412307']

var getDate = function (date) {
    return date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear()
}

var getDates = function () {
    let weekDates = []
    weekDates.push(getDate(new Date))
    for (let i = 1; i < 3; i++) {
        let date = new Date((new Date).getTime() + (i * 7 * 24 * 60 * 60 * 1000));
        weekDates.push(getDate(date))
    }
    return weekDates
}

var getVaccineData = function () { //NOSONAR
    var promises = []
    var dates = getDates()

    pincodes.forEach(pincode => {
        dates.forEach(date => {
            var cowinQuery = {
                method: 'GET',
                url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin',
                qs: { pincode: pincode, date: date },
                headers: { accept: 'application/json' }
            };
            let promise = new Promise(function (resolve, reject) {
                request(cowinQuery, function (error, response, body) {
                    if (error) {
                        console.log(error);
                        reject(error);
                    } else {
                        resolve(body);
                    }
                });
            });
            promises.push(promise)
        })
    })
    return Promise.all(promises)
};

var notify = function (pincodeMap) {
    if (pincodeMap.size === 0) {
        console.log('Vaccine Not Available')
    } else {
        for (let [key, value] of pincodeMap) {
            console.log('Vaccine Available for pincode ' + key + " " + value.join())
            notifier.notify({
                'title': 'Vaccine Available for pincode ' + key,
                'message': value.join(),
                'sound': true,
                wait: true,
                timeout: 20
            });
        }
    }

}

const executeBacth = function () {
    try {
        getVaccineData().then(body => {
            let pincodeMap = new Map()
            if (body) {
                body.forEach(data => {
                    try { data = JSON.parse(data) } catch (err) {
                        console.log(data);
                        throw err
                    }
                    if (data && data.centers && data.centers.length > 0) {
                        data.centers.forEach(center => {
                            if (center && center.sessions && center.sessions.length > 0) {
                                center.sessions.forEach(session => {
                                    if (session && session.available_capacity > 0) {
                                        let msg = center.name + " on " + session.date + " count : " + session.available_capacity
                                        if (pincodeMap.has(center.pincode)) {
                                            let slots = pincodeMap.get(center.pincode)
                                            if (!slots.includes(msg)) {
                                                slots.push(msg)
                                            }
                                        } else {
                                            pincodeMap.set(center.pincode, [msg])
                                        }
                                    }
                                })
                            }
                        });
                    }
                })
            }
            notify(pincodeMap)
        }).catch(error => {
            console.log(error);
        })
    } catch (error) {
        console.log(error);
    }
}

const job = schedule.scheduleJob('* * * * *', function () {
    console.log('\n<<--- Checking availability at ' + (new Date()).toString() + ' --->>')
    executeBacth()
    setTimeout(() => {
        executeBacth()
    }, 15000)
    setTimeout(() => {
        executeBacth()
    }, 30000)
    setTimeout(() => {
        executeBacth()
    }, 45000)
});