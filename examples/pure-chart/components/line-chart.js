import React, { Component } from 'react'
import { Dimensions, Platform, Text, View } from 'react-native'
import { connect } from 'react-redux'
import { Container, Content } from 'native-base'
import FooterScreen from '../Components/Setting/FooterScreen'
import HeaderScreen from '../Components/Setting/HeaderScreen'
import colors from '../Themes/Colors'
import PureChart from 'react-native-pure-chart'
import I18n from '../I18n'
import RowSelectFromDayToDay from '../Components/Setting/RowSelectFromDayToDay'
import RowButtonAction from '../Components/Setting/RowButtonAction'
import CustomAPI from '../Services/CustomAPI'
import {
  API_SHOW_INTERMITTENT,
  DEVICE,
  MILI_SECOND_ONE_DAY,
  SELECT_WEEK_MONTH,
  TIME_END_DAY,
  TIME_START_DAY,
  TYPE
} from '../Lib/constant'
import {
  backTimeFrom,
  backTimeTo,
  checkAuthen3rdParty,
  convertDateToTime,
  encodeQueryData,
  getArrayFromDateToDate,
  getMaxValue,
  getMinValue,
  initDayMonthYearFrom,
  initDayMonthYearTo,
  nextTimeFrom,
  nextTimeTo
} from '../Lib/common'
import {
  preHandlerDataWeightServerRespone,
  adapterGetWeightFromDayToDay,
  getDataWeightDateRecentHaveData
} from '../Lib/HandlerWeight'
import { getWeightFromAppleHealth } from '../Lib/AppleHealthLib'
import { getWeightFromGoogleFit } from '../Lib/GoogleFitAppLib'
import moment from '../Config/CommentConfig'
import RowSelectWeekMonth from '../Components/Setting/RowSelectWeekMonth'
import TableDataWeight from '../Components/Weight/TableDataWeight'
import common from '../Redux/common'
import Swiper from 'react-native-swiper'

class WeightGraphScreen extends Component {
  constructor (props) {
    super(props)
    this.state = {
      heightWidow: Platform.OS === 'ios' ? Dimensions.get('window').height : (Dimensions.get('window').height - 60),
      initDayMonthYearFrom: null,
      initDayMonthYearTo: null,
      selectWeekMonth: SELECT_WEEK_MONTH.week,
      arrDataReality: [
        { x: moment().format('YYYY-MM-DD'), y: 0 }
      ],
      arrDataGoal: [
        { x: moment().format('YYYY-MM-DD'), y: 0 }
      ],
      arrDataTable: [],
      stepGoal: 0,
      weightCurrentDate: 0,
      maxY: -1,
      minY: -1,
      lastIsBlank: true
    }

    // handler when rorate
    Dimensions.addEventListener('change', () => {
      this.setState({
        heightWidow: Platform.OS === 'ios' ? Dimensions.get('window').height : (Dimensions.get('window').height - 60)
      })
    })
  }

  componentWillMount () {
    let dateMarker = moment().format('YYYY-MM-DD')
    let typeSelect = this.state.selectWeekMonth

    if (this.props.navigation &&
      this.props.navigation.state &&
      this.props.navigation.state.params &&
      this.props.navigation.state.params.dateParam
    ) {
      dateMarker = this.props.navigation.state.params.dateParam
    }

    if (this.props.navigation &&
      this.props.navigation.state &&
      this.props.navigation.state.params &&
      this.props.navigation.state.params.typeSelect
    ) {
      typeSelect = this.props.navigation.state.params.typeSelect
    }

    let objDayMonthYearFrom = initDayMonthYearFrom(dateMarker, typeSelect)
    let objDayMonthYearTo = initDayMonthYearTo(dateMarker, typeSelect)
    this.loadData(objDayMonthYearFrom, objDayMonthYearTo, typeSelect)
  }

  adapterGetWeightFromApp (date = moment().format('YYYY-MM-DD')) {
    if (!checkAuthen3rdParty(this.props.userInfo)) {
      return new Promise((resolve, reject) => {
        reject()
      })
    }
    if (Platform.OS === 'ios') {
      return getWeightFromAppleHealth(date)
    } else {
      return getWeightFromGoogleFit(date)
    }
  }

  async loadData (objDayMonthYearFrom, objDayMonthYearTo, typeSelect = SELECT_WEEK_MONTH.week) {
    this.props.setLoading(true)
    if (moment(objDayMonthYearTo.valueDateTo).format('YY-MM-DD') < moment().format('YY-MM-DD')) {
      this.setState({
        lastIsBlank: false
      })
    }
    let startDate = moment(objDayMonthYearFrom.valueDateFrom).subtract(1, 'days')
    let stopDate = moment(objDayMonthYearTo.valueDateTo)
    let weightCurrentDate = this.state.weightCurrentDate
    let objParam = {
      fromTime: startDate.format('YYYY-MM-DD') + TIME_START_DAY,
      toTime: stopDate.format('YYYY-MM-DD') + TIME_END_DAY,
      device: DEVICE.all,
      type: TYPE.weight,
      limit: 100
    }

    let arrDataFromApp = []
    await adapterGetWeightFromDayToDay(moment(startDate).format('YYYY-MM-DD'), moment(stopDate).format('YYYY-MM-DD'))
      .then((res) => {
        if (res && res.length > 0) {
          for (let i = 0; i < res.length; i++) {
            let tempValue = {
              time: res[i].startDate,
              value: Platform.OS === 'ios' ? res[i].value / 1000 : res[i].value
            }
            arrDataFromApp.push(tempValue)
          }
        }
      })
      .catch((error) => {
        arrDataFromApp = []
      })

    let urlWeightReality = API_SHOW_INTERMITTENT + '?' + encodeQueryData(objParam)
    let promiseWeightReality = CustomAPI.create(urlWeightReality).getData()

    let objParamGoal = {
      'type': TYPE.goal,
      'device': DEVICE.all,
      'limit': 1
    }
    let urlGoal = API_SHOW_INTERMITTENT + '?' + encodeQueryData(objParamGoal)
    let promiseGoal = CustomAPI.create(urlGoal).getData()
    let arrFromDateToDate = getArrayFromDateToDate(startDate, stopDate)

    let weightDateRecentestHaveData = null
    let hasData = false
    await getDataWeightDateRecentHaveData(moment(objDayMonthYearFrom.valueDateFrom).format('YYYY-MM-DD'))
      .then((res) => {
        if (res && res.valueWeight && !isNaN(res.valueWeight)) {
          weightDateRecentestHaveData = Math.round(parseFloat(res.valueWeight) * 100) / 100
          hasData = true
        }
      })

    let arrDataGraph = [{
      x: '1',
      y: weightDateRecentestHaveData
    }]
    let arrDataTable = []
    let arrObjGoal = []
    let weightGoal = 0
    let oldWeight = 0
    let month = moment(objDayMonthYearFrom.valueDateFrom).format('MM')
    Promise.all([promiseWeightReality, promiseGoal])
      .then(async (res) => {
        for (let i = 0; i < arrFromDateToDate.length; i++) {
          try {
            let timeMoment = moment(arrFromDateToDate[i])
            let strX
            if (i === 1 || month !== timeMoment.format('MM')) {
              strX = timeMoment.format('MM/DD')
            } else {
              strX = timeMoment.format('DD')
            }

            let tempDataGraph = {
              x: strX,
              y: null
            }

            let tempY = null

            let tempDataTable = {
              date: arrFromDateToDate[i],
              weight: 0,
              durationWeight: 0
            }

            let strDate = moment(arrFromDateToDate[i]).format('YYYY-MM-DD')
            let arrDetailDataTable = []
            arrDetailDataTable[strDate] = []

            if (res[0] &&
              res[0].data &&
              res[0].data.weight &&
              res[0].data.weight.record
            ) {
              let preHandlerData = preHandlerDataWeightServerRespone(res[0].data.weight.record)
              let arrKeyDate = Object.keys(preHandlerData)
              let arrValueDate = Object.values(preHandlerData)
              if (arrKeyDate.indexOf(arrFromDateToDate[i]) >= 0) {
                tempY = Math.round(arrValueDate[arrKeyDate.indexOf(arrFromDateToDate[i])].value * 100) / 100
              }

              // data detail from app
              let valueApp = '-'
              let timeApp = '--:--'
              for (let j = 0; j < arrDataFromApp.length; j++) {
                if (arrDataFromApp[j].time && arrFromDateToDate[i] === moment(arrDataFromApp[j].time).format('YYYY-MM-DD')) {
                  let detailDataTable = {}
                  detailDataTable.data_from_app = {}
                  valueApp = parseFloat(arrDataFromApp[j].value).toFixed(2)
                  timeApp = moment(arrDataFromApp[j].time).format('HH:mm')
                  detailDataTable.data_from_app.value = valueApp
                  detailDataTable.data_from_app.time_hour = timeApp
                  arrDetailDataTable[strDate].push(detailDataTable)
                }
              }

              if (!tempY && valueApp !== '-') {
                tempY = valueApp
              }

              if (tempY) {
                hasData = true
                tempDataGraph.y = Math.round(tempY * 100) / 100
                tempDataTable.weight = Math.round(tempY * 100) / 100
                tempDataTable.durationWeight = Math.round((tempY - oldWeight) * 100) / 100
                oldWeight = tempY
              } else {
                tempDataTable.weight = Math.round(0 * 100) / 100
                tempDataTable.durationWeight = Math.round((0 - oldWeight) * 100) / 100
                oldWeight = 0
              }

              // data detail from cloud
              let arrKeyDataRes = Object.keys(res[0].data.weight.record)
              let arrValueDataRes = Object.values(res[0].data.weight.record)
              for (let j = 0; j < arrKeyDataRes.length; j++) {
                if (moment(arrKeyDataRes[j]).format('YYYY-MM-DD') === arrFromDateToDate[i]) {
                  if (arrValueDataRes[j] && arrValueDataRes[j].self && arrValueDataRes[j].self.value) {
                    let detailDataTable = {}
                    detailDataTable.self = {}
                    detailDataTable.self.value = arrValueDataRes[j].self.value
                    detailDataTable.self.time_hour = moment(arrKeyDataRes[j]).format('HH:mm')
                    arrDetailDataTable[strDate].push(detailDataTable)
                  }

                  if (arrValueDataRes[j] && arrValueDataRes[j].tanita && arrValueDataRes[j].tanita.value) {
                    let detailDataTable = {}
                    detailDataTable.tanita = {}
                    detailDataTable.tanita.value = arrValueDataRes[j].tanita.value
                    detailDataTable.tanita.time_hour = moment(arrKeyDataRes[j]).format('HH:mm')
                    arrDetailDataTable[strDate].push(detailDataTable)
                  }

                  if (arrValueDataRes[j] && arrValueDataRes[j].withings && arrValueDataRes[j].withings.value) {
                    let detailDataTable = {}
                    detailDataTable.withings = {}
                    detailDataTable.withings.value = arrValueDataRes[j].withings.value
                    detailDataTable.withings.time_hour = moment(arrKeyDataRes[j]).format('HH:mm')
                    arrDetailDataTable[strDate].push(detailDataTable)
                  }
                }
              }
              tempDataTable.detailDataTable = arrDetailDataTable[strDate]
            } else {
              let valueApp = '-'
              let timeApp = '--:--'
              for (let j = 0; j < arrDataFromApp.length; j++) {
                if (arrFromDateToDate[i] === moment(arrDataFromApp[j].time).format('YYYY-MM-DD')) {
                  let detailDataTable = {}
                  detailDataTable.data_from_app = {}
                  valueApp = arrDataFromApp[i].value
                  timeApp = moment(arrDataFromApp[i].time).format('HH:mm')
                  detailDataTable.data_from_app.value = valueApp
                  detailDataTable.data_from_app.time_hour = timeApp
                  arrDetailDataTable[strDate].push(detailDataTable)
                }
              }

              if (valueApp !== '-') {
                hasData = true
                tempDataGraph.y = Math.round(valueApp * 100) / 100
                tempDataTable.weight = Math.round((valueApp - oldWeight) * 100) / 100
                tempDataTable.durationWeight = Math.round(valueApp * 100) / 100
                oldWeight = valueApp
              } else {
                tempDataTable.weight = Math.round((0 - oldWeight) * 100) / 100
                tempDataTable.durationWeight = Math.round(0 * 100) / 100
                oldWeight = 0
              }
              tempDataTable.detailDataTable = arrDetailDataTable[strDate]
            }

            if (i > 0) {
              if (arrFromDateToDate[i] === moment().format('YYYY-MM-DD')) {
                weightCurrentDate = tempDataGraph.y
              }
              arrDataGraph.push(tempDataGraph)
              arrDataTable.push(tempDataTable)
            }
          } catch (error) {
            console.log('error 12345678', error)
          }
        }

        if (res[1] && res[1].status === 200 && res[1].data && res[1].data.goal && res[1].data.goal.record) {
          arrObjGoal = await this.initValueLineGoal(res[1].data.goal.record, objDayMonthYearFrom, objDayMonthYearTo)
        } else {
          let startDateMoment = moment(objDayMonthYearFrom.valueDateFrom)
          let month = parseInt(startDateMoment.format('MM'))
          for (let i = 0; i < 7; i++) {
            let currentMonth = parseInt(startDateMoment.format('MM'))
            let strX
            if (i === 0 || month !== currentMonth) {
              strX = startDateMoment.format('MM/DD')
            } else {
              strX = startDateMoment.format('DD')
            }
            let tempObjDataGraph = {
              x: strX,
              y: null
            }
            arrObjGoal.push(tempObjDataGraph)
            startDateMoment.add(1, 'days')
          }
        }
        let dataArrays = []
        if (arrDataGraph.length > 0 && hasData) {
          dataArrays.push({
            seriesName: 'step reality',
            data: arrDataGraph,
            color: 'pink'
          })
        }
        if (arrObjGoal.length > 0) {
          dataArrays.push({
            seriesName: 'step goal',
            data: arrObjGoal,
            color: 'transparent'
          })
        }
        let maxValue = getMaxValue(dataArrays)
        let minValue = getMinValue(dataArrays)
        if (maxValue === minValue) {
          maxValue++
          minValue = 0
        }
        if (!hasData) {
          minValue = 0
        }
        let minY = 1.3 * minValue - 0.3 * maxValue > 0 ? 1.3 * minValue - 0.3 * maxValue : 0
        let maxY = 1.3 * maxValue - 0.3 * minValue
        // khi tuần trước đó không có data thì phải ẩn đường thẳng đi
        this.indexDisplay = -1
        if(!this.isLastWeekHaveData) {
          const index = arrDataTable.findIndex((item) => item.weight !== 0);
          this.indexDisplay = index;
        }
        this.setState({
          initDayMonthYearFrom: objDayMonthYearFrom,
          initDayMonthYearTo: objDayMonthYearTo,
          arrDataReality: arrDataGraph.length ? arrDataGraph : this.state.arrDataReality,
          arrDataGoal: arrObjGoal.length ? arrObjGoal : arrObjGoal,
          arrDataTable: arrDataTable,
          selectWeekMonth: typeSelect,
          weightGoal: weightGoal,
          weightCurrentDate: weightCurrentDate,
          minY: minY,
          maxY: maxY
        })
        this.props.setLoading(false)
      })
      .catch((error) => {
        this.setState({
          initDayMonthYearFrom: objDayMonthYearFrom,
          initDayMonthYearTo: objDayMonthYearTo,
          arrDataReality: arrDataGraph.length ? arrDataGraph : this.state.arrDataReality,
          arrDataGoal: arrObjGoal.length ? arrObjGoal : arrObjGoal,
          arrDataTable: arrDataTable,
          selectWeekMonth: typeSelect,
          weightGoal: weightGoal,
          weightCurrentDate: weightCurrentDate
        })
        this.props.setLoading(false)
      })
  }
  checkHavaDateTimeAgo = async (dateString) => {
    const yesterday = moment(dateString, "DD/MM/YYYY").add(-1, 'days');
    const value = await getDataWeightDateRecentHaveData(yesterday.toLocaleString());
    if(value.valueWeight) return true;
    return false
    
  }
  initValueLineGoal  = async (goal = null, objDayMonthYearFrom, objDayMonthYearTo) => {
    this.isLastWeekHaveData = await this.checkHavaDateTimeAgo(objDayMonthYearFrom.valueDateFrom);
    let startDateMoment = moment(moment(objDayMonthYearFrom.valueDateFrom).subtract('1', 'days').format('YYYY-MM-DD'), 'YYYY-MM-DD')
    let endDateMoment = moment(moment(objDayMonthYearTo.valueDateTo).format('YYYY-MM-DD'), 'YYYY-MM-DD')
    let totalDay = endDateMoment.diff(startDateMoment, 'days', true)
    totalDay = Math.round(totalDay)
    if (totalDay < 8) {
      totalDay = 8
    } else {
      totalDay++
    }
    let arrValueDate = Object.values(goal)
    let arrDataGoal = []
    let timeWeightStartDate
    let timeWeightEndDate
    let durationEachDay
    let startDateGoalMoment
    let endDateGoalMoment
    if (arrValueDate[0] &&
      arrValueDate[0].self &&
      arrValueDate[0].self.value
    ) {
      let objGoal = JSON.parse(arrValueDate[0].self.value)
      if (objGoal.weight.startdate && objGoal.weight.enddate && objGoal.weight.goal) {
        let weightStartDate = objGoal.weight.startdate
        let weightEndDate = objGoal.weight.enddate
        startDateGoalMoment = moment(weightStartDate, 'YYYY-MM-DD')
        endDateGoalMoment = moment(weightEndDate, 'YYYY-MM-DD')
        timeWeightStartDate = convertDateToTime(weightStartDate)
        timeWeightEndDate = convertDateToTime(weightEndDate)

        let totalDayStartEnd = (timeWeightEndDate - timeWeightStartDate) / MILI_SECOND_ONE_DAY
        durationEachDay = (objGoal.weight.goal - objGoal.weight.current) / totalDayStartEnd
        durationEachDay = Math.round(durationEachDay * 100) / 100
      }
    }
    let month = null
    for (let i = 0; i < totalDay; i++) {
      let currentMonth = parseInt(startDateMoment.format('MM'))
      let strX
      if (i === 1) {
        month = parseInt(startDateMoment.format('MM'))
      }
      if (i === 1 || month !== currentMonth) {
        strX = startDateMoment.format('MM/DD')
      } else {
        strX = startDateMoment.format('DD')
      }
      let tempObjDataGraph = {
        x: strX,
        y: null
      }

      if (arrValueDate[0] && arrValueDate[0].self && arrValueDate[0].self.value) {
        let objGoal = JSON.parse(arrValueDate[0].self.value)
        let strY = 0
        if (!objGoal.weight.startdate && !objGoal.weight.enddate && objGoal.weight.goal) {
          strY = objGoal.weight.goal
          tempObjDataGraph.color = 'blue'
        } else {
          if (startDateMoment < objGoal.weight.startdate || startDateMoment > objGoal.weight.enddate) {
            tempObjDataGraph.color = 'rgba(255,255,255,0)'
            tempObjDataGraph.y = null
          } else {
            let totalDay = ((startDateMoment.format('x') - timeWeightStartDate) / MILI_SECOND_ONE_DAY)
            if (i === 0) {
              strY = parseFloat(objGoal.weight.current) + parseFloat(totalDay * durationEachDay) + parseFloat(2 * durationEachDay / 3)
            } else {
              strY = parseFloat(objGoal.weight.current) + parseFloat(totalDay * durationEachDay)
            }
            tempObjDataGraph.color = 'blue'
            tempObjDataGraph.y = Math.round(strY * 100) / 100
          }
        }
      } else {
        tempObjDataGraph.y = 0
      }
      if (startDateGoalMoment > startDateMoment || startDateMoment > endDateGoalMoment) {
        tempObjDataGraph.color = 'rgba(255,255,255,0)'
      }
      arrDataGoal.push(tempObjDataGraph)
      startDateMoment.add(1, 'days')
    }
    return arrDataGoal
  }

  goToSettingWeightInDay () {
    this.props.navigation.navigate('SettingWeightInDayScreen', {
      dateParam: moment().format('YYYY-MM-DD'),
      weightParam: this.state.weightCurrentDate,
      typeSelect: this.state.selectWeekMonth
    })
  }

  goToWeightGraph () {
    this.props.navigation.navigate('WeightGraphScreen')
  }

  selectWeek () {
    let dateMarker = moment().format('YYYY-MM-DD')
    let objDayMonthYearFrom = initDayMonthYearFrom(dateMarker, SELECT_WEEK_MONTH.week)
    let objDayMonthYearTo = initDayMonthYearTo(dateMarker, SELECT_WEEK_MONTH.week)
    this.loadData(objDayMonthYearFrom, objDayMonthYearTo, SELECT_WEEK_MONTH.week)
  }

  selectMonth () {
    let dateMarker = moment().format('YYYY-MM-DD')
    let objDayMonthYearFrom = initDayMonthYearFrom(dateMarker, SELECT_WEEK_MONTH.month)
    let objDayMonthYearTo = initDayMonthYearTo(dateMarker, SELECT_WEEK_MONTH.month)
    this.loadData(objDayMonthYearFrom, objDayMonthYearTo, SELECT_WEEK_MONTH.month)
  }

  backTime () {
    let dateMarker = this.state.initDayMonthYearTo.valueDateTo

    let objDayFrom = backTimeFrom(dateMarker, this.state.selectWeekMonth)
    let objDayTo = backTimeTo(dateMarker, this.state.selectWeekMonth)

    this.loadData(objDayFrom, objDayTo, this.state.selectWeekMonth)
  }

  nextTime () {
    let dateMarker = this.state.initDayMonthYearTo.valueDateTo
    let objDayFrom = nextTimeFrom(dateMarker, this.state.selectWeekMonth)
    let objDayTo = nextTimeTo(dateMarker, this.state.selectWeekMonth)
    this.loadData(objDayFrom, objDayTo, this.state.selectWeekMonth)
  }

  goBack () {
    this.props.navigation.navigate('HomeScreen')
  }

  selectFromDayToDay (dateFrom = new Date(), dateTo = new Date()) {
    let objDayMonthYearFrom = {
      valueDateFrom: dateFrom,
      strDateFrom: moment(dateFrom).format('LL')
    }

    let objDayMonthYearTo = {
      valueDateTo: dateTo,
      strDateTo: moment(dateTo).format('LL')
    }
    this.loadData(objDayMonthYearFrom, objDayMonthYearTo)
  }

  pageFlick (index) {
    if (index != 1) {
      if (index == 0) {
        this.backTime()
      } else if (index == 2) {
        this.nextTime()
      }
      this.refs.swiperRef.scrollBy(0, false)

    }
  }

  render () {
    let sampleData = []
    if (this.state.arrDataGoal.length > 0) {
      sampleData.push({
        seriesName: 'step goal',
        data: this.state.arrDataGoal,
        color: 'transparent',
        seriesLabel: '目標体重'
      })
    }
    if (this.state.arrDataReality.length > 0) {
      sampleData.push({
        seriesName: 'step reality',
        data: this.state.arrDataReality,
        color: 'pink',
        seriesLabel: '体重',
        lastIsBlank: this.state.lastIsBlank
      })
    }
    return (
      <Swiper
        ref="swiperRef"
        showsButtons={true}
        loop={false}
        onIndexChanged={(index) => {this.pageFlick(index)}}
        index={1}
        showsButtons={false}
        showsPagination={false}
      >
        {/* first swiper */}
        <View style={{
          minHeight: this.state.heightWidow,
          backgroundColor: '#1BC247'
        }}>
          <HeaderScreen
            onPressProps={this.goBack.bind(this)}
            textContent={I18n.t('weight_graph.title_screen')}
            navigation={this.props.navigation}
          />
        </View>

        {/* second swiper */}
        <Container style={{
          minHeight: this.state.heightWidow
        }}>
          <HeaderScreen
            onPressProps={this.goBack.bind(this)}
            textContent={I18n.t('weight_graph.title_screen')}
            navigation={this.props.navigation}
          />
          <Content style={{ backgroundColor: '#1BC247' }}>
            <View style={{
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <RowButtonAction
                goToEdit={this.goToSettingWeightInDay.bind(this)}
                goToGraph={this.goToWeightGraph.bind(this)}
                navigation={this.props.navigation}
              />

              <RowSelectFromDayToDay
                onPressProps={this.selectFromDayToDay.bind(this)}
                nextTimeProps={this.nextTime.bind(this)}
                backTimeProps={this.backTime.bind(this)}
                initDayMonthYearFrom={this.state.initDayMonthYearFrom}
                initDayMonthYearTo={this.state.initDayMonthYearTo}
                ref='fromDayToDay'
              />

              <RowSelectWeekMonth
                selectMonthProps={this.selectMonth.bind(this)}
                selectWeekProps={this.selectWeek.bind(this)}
                typeSelect={this.state.selectWeekMonth}
              />
            </View>

            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5 }}>
              <Text style={{ color: 'white' }}>(kg)</Text>
            </View>
            <View style={{
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {
                this.state.arrDataReality.length > 0 &&
                (
                  <View style={{
                    width: '100%',
                    paddingTop: 20
                  }}>
                    <PureChart
                      data={sampleData}
                      type='line'
                      height={300}
                      xAxisColor={colors.white_font_color}
                      yAxisColor={'transparent'}
                      xAxisGridLineColor={'transparent'}
                      yAxisGridLineColor={colors.white_font_color}
                      labelColor={colors.white_font_color}
                      showEvenNumberXaxisLabel={false}
                      minY={this.state.minY}
                      maxY={this.state.maxY}
                      notPaddingLeft
                      indexDisplay={this.indexDisplay}
                    />
                  </View>
                )
              }

              <TableDataWeight
                dataTableProps={this.state.arrDataTable}
                navigation={this.props.navigation}
                typeSelect={this.state.selectWeekMonth}
              />
            </View>
          </Content>
          <FooterScreen
            navigation={this.props.navigation}
          />
        </Container>

        {/* third swiper */}
        <View style={{
          minHeight: this.state.heightWidow,
          backgroundColor: '#1BC247'
        }}>
          <HeaderScreen
            onPressProps={this.goBack.bind(this)}
            textContent={I18n.t('weight_graph.title_screen')}
            navigation={this.props.navigation}
          />
        </View>
      </Swiper>
    )
  }
}

const mapStateToProps = (state) => {
  return {
    userInfo: state.userInfo.user_info
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    setLoading: (isLoading) => dispatch(common.setLoading(isLoading))
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(WeightGraphScreen)
