/* eslint no-debugger: "warn" */
import cx from 'classnames'
import React, {Component} from 'react'
import PropTypes from 'prop-types'
import ResizeObserver from 'resize-observer-polyfill'
import {capitalize, clamp} from './utils'

/**
 * Predefined constants
 * @type {Object}
 */
const constants = {
  orientation: {
    horizontal: {
      dimension: 'width',
      direction: 'left',
      reverseDirection: 'right',
      coordinate: 'x'
    },
    vertical: {
      dimension: 'height',
      direction: 'top',
      reverseDirection: 'bottom',
      coordinate: 'y'
    }
  }
}

class Slider extends Component {
  static propTypes = {
    min: PropTypes.number,
    max: PropTypes.number,
    step: PropTypes.number,
    value: PropTypes.number,
    orientation: PropTypes.string,
    tooltip: PropTypes.bool,
    tooltipWithInput: PropTypes.bool,
    reverse: PropTypes.bool,
    labels: PropTypes.object,
    handleLabel: PropTypes.string,
    format: PropTypes.func,
    onChangeStart: PropTypes.func,
    onChange: PropTypes.func,
    onChangeComplete: PropTypes.func
  };

  static defaultProps = {
    min: 0,
    max: 100,
    step: 1,
    value: 0,
    orientation: 'horizontal',
    tooltip: true,
    reverse: false,
    labels: {},
    handleLabel: ''
  };

  input = undefined

  constructor (props, context) {
    super(props, context)

    this.state = {
      active: false,
      limit: 0,
      grab: 0
    }
  }

  componentDidMount () {
    this.handleUpdate()
    const resizeObserver = new ResizeObserver(this.handleUpdate)
    resizeObserver.observe(this.slider)
  }

  /**
   * Format label/tooltip value
   * @param  {Number} - value
   * @return {Formatted Number}
   */
  handleFormat = value => {
    const { format } = this.props
    return format ? format(value) : value
  };

  /**
   * Update slider state on change
   * @return {void}
   */
  handleUpdate = () => {
    if (!this.slider) {
      // for shallow rendering
      return
    }
    const { orientation } = this.props
    const dimension = capitalize(constants.orientation[orientation].dimension)
    const sliderPos = this.slider[`offset${dimension}`]
    const handlePos = this.handle[`offset${dimension}`]

    this.setState({
      limit: sliderPos - handlePos,
      grab: handlePos / 2
    })
  };

  /**
   * Attach event listeners to mousemove/mouseup events
   * @return {void}
   */
  handleStart = e => {
    if (e.target.tagName === 'INPUT') return
    const { onChangeStart } = this.props
    document.addEventListener('mousemove', this.handleDrag)
    document.addEventListener('mouseup', this.handleEnd)
    this.setState(
      {
        active: true
      },
      () => {
        onChangeStart && onChangeStart(e)
      }
    )
  };

  /**
   * Handle drag/mousemove event
   * @param  {Object} e - Event object
   * @return {void}
   */
  handleDrag = e => {
    if (e.target.tagName === 'INPUT') return
    e.stopPropagation()
    const { onChange } = this.props
    const { target: { className, classList, dataset } } = e
    if (!onChange || className === 'rangeslider__labels') return

    let value = this.position(e)

    if (
      classList &&
      classList.contains('rangeslider__label-item') &&
      dataset.value
    ) {
      value = parseFloat(dataset.value)
    }

    this.changeValue(value, e)
  };

  /**
   * Detach event listeners to mousemove/mouseup events
   * @return {void}
   */
  handleEnd = e => {
    if (e.target.tagName === 'INPUT') return
    const { onChangeComplete } = this.props
    this.setState(
      {
        active: false
      },
      () => {
        onChangeComplete && onChangeComplete(e)
      }
    )
    document.removeEventListener('mousemove', this.handleDrag)
    document.removeEventListener('mouseup', this.handleEnd)
  };

  /**
   * Support for key events on the slider handle
   * @param  {Object} e - Event object
   * @return {void}
   */
  handleKeyDown = e => {
    if (e.target.tagName === 'INPUT') return

    const { keyCode } = e
    const { value, min, max, step } = this.props
    let sliderValue

    switch (keyCode) {
      case 38:
      case 39:
        e.preventDefault()
        sliderValue = value + step > max ? max : value + step

        this.changeValue(sliderValue, e)
        break
      case 37:
      case 40:
        e.preventDefault()
        sliderValue = value - step < min ? min : value - step

        this.changeValue(sliderValue, e)
        break
    }
  };

  /**
   * Calculate position of slider based on its value
   * @param  {number} value - Current value of slider
   * @return {position} pos - Calculated position of slider based on value
   */
  getPositionFromValue = value => {
    const { limit } = this.state
    const { min, max } = this.props
    const diffMaxMin = max - min
    const diffValMin = value - min
    const percentage = diffValMin / diffMaxMin
    const pos = Math.round(percentage * limit)

    return pos
  };

  /**
   * Translate position of slider to slider value
   * @param  {number} pos - Current position/coordinates of slider
   * @return {number} value - Slider value
   */
  getValueFromPosition = pos => {
    const { limit } = this.state
    const { orientation, min, max, step } = this.props
    const percentage = clamp(pos, 0, limit) / (limit || 1)
    const baseVal = step * Math.round(percentage * (max - min) / step)
    const value = orientation === 'horizontal' ? baseVal + min : max - baseVal

    return clamp(value, min, max)
  };

  /**
   * Calculate position of slider based on value
   * @param  {Object} e - Event object
   * @return {number} value - Slider value
   */
  position = e => {
    const { grab } = this.state
    const { orientation, reverse } = this.props

    const node = this.slider
    const coordinateStyle = constants.orientation[orientation].coordinate
    const directionStyle = reverse
      ? constants.orientation[orientation].reverseDirection
      : constants.orientation[orientation].direction
    const clientCoordinateStyle = `client${capitalize(coordinateStyle)}`
    const coordinate = !e.touches
      ? e[clientCoordinateStyle]
      : e.touches[0][clientCoordinateStyle]
    const direction = node.getBoundingClientRect()[directionStyle]
    const pos = reverse
      ? direction - coordinate - grab
      : coordinate - direction - grab
    const value = this.getValueFromPosition(pos)

    return value
  };

  /**
   * Grab coordinates of slider
   * @param  {Object} pos - Position object
   * @return {Object} - Slider fill/handle coordinates
   */
  coordinates = pos => {
    const { limit, grab } = this.state
    const { orientation } = this.props
    const value = this.getValueFromPosition(pos)
    const position = this.getPositionFromValue(value)
    const handlePos = orientation === 'horizontal' ? position + grab : position
    const fillPos = orientation === 'horizontal'
      ? handlePos
      : limit - handlePos

    return {
      fill: fillPos,
      handle: handlePos,
      label: handlePos
    }
  };

  changeValue = (value, target) => {
    const { onChange } = this.props
    if (this.input) {
      this.input.value = this.handleFormat(value)
    }
    onChange && onChange(value, target)
  }

  setInputRef = input => {
    this.input = input
    if (input) {
      input.value = this.handleFormat(this.props.value)
    }
  }

  onInputChange = event => {
    const { min, max, step, onChange } = this.props
    const value = parseFloat(event.target.value.replace(',', '.'))
    const rounded = Math.round(value / step) * step
    const clamped = clamp(rounded, min, max)

    if (!isNaN(value)) {
      if (rounded !== clamped) {
        event.target.value = this.handleFormat(clamped);
      }
      onChange && onChange(clamped, event.target)
      this.state.inputIsValid || this.setState({ inputIsValid: true })
    } else {
      this.state.inputIsValid && this.setState({ inputIsValid: false })
    }
  }

  renderLabels = labels => (
    <ul
      ref={sl => {
        this.labels = sl
      }}
      className={cx('rangeslider__labels')}
    >
      {labels}
    </ul>
  );

  render () {
    const {
      value,
      orientation,
      className,
      tooltip,
      reverse,
      labels,
      min,
      max,
      handleLabel,
      tooltipWithInput
    } = this.props
    const { active } = this.state
    const dimension = constants.orientation[orientation].dimension
    const direction = reverse
      ? constants.orientation[orientation].reverseDirection
      : constants.orientation[orientation].direction
    const position = this.getPositionFromValue(value)
    const coords = this.coordinates(position)
    const fillStyle = { [dimension]: `${coords.fill}px` }
    const handleStyle = { [direction]: `${coords.handle}px` }
    let showTooltip = tooltipWithInput || (tooltip && active)

    let labelItems = []
    let labelKeys = Object.keys(labels)

    if (labelKeys.length > 0) {
      labelKeys = labelKeys.sort((a, b) => (reverse ? a - b : b - a))

      for (let key of labelKeys) {
        const labelPosition = this.getPositionFromValue(key)
        const labelCoords = this.coordinates(labelPosition)
        const labelStyle = { [direction]: `${labelCoords.label}px` }

        labelItems.push(
          <li
            key={key}
            className={cx('rangeslider__label-item')}
            data-value={key}
            onMouseDown={this.handleDrag}
            onTouchStart={this.handleStart}
            onTouchEnd={this.handleEnd}
            style={labelStyle}
          >
            {this.props.labels[key]}
          </li>
        )
      }
    }

    return (
      <div
        ref={s => {
          this.slider = s
        }}
        className={cx(
          'rangeslider',
          `rangeslider-${orientation}`,
          { 'rangeslider-reverse': reverse },
          className
        )}
        onMouseDown={this.handleDrag}
        onMouseUp={this.handleEnd}
        onTouchStart={this.handleStart}
        onTouchEnd={this.handleEnd}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-orientation={orientation}
      >
        <div className='rangeslider__fill' style={fillStyle} />
        <div
          ref={sh => {
            this.handle = sh
          }}
          className='rangeslider__handle'
          onMouseDown={this.handleStart}
          onTouchMove={this.handleDrag}
          onTouchEnd={this.handleEnd}
          onKeyDown={this.handleKeyDown}
          style={handleStyle}
          tabIndex={0}
        >
          {showTooltip
            ? <div
              ref={st => {
                this.tooltip = st
              }}
              className='rangeslider__handle-tooltip'
              >
              {
                tooltipWithInput
                ? <input onChange={this.onInputChange} ref={this.setInputRef} maxLength={4} />
                : <span>{this.handleFormat(value)}</span>
              }
            </div>
            : null}
          <div className='rangeslider__handle-label'>{handleLabel}</div>
        </div>
        {labels ? this.renderLabels(labelItems) : null}
      </div>
    )
  }
}

export default Slider
