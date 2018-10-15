import React from 'react';

export default class Progress extends React.Component {
  render() {
    const { percent } = this.props;
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const percentageValue = circumference * (1 - percent);

    const circleProps = {
      cx: 50,
      cy: 50,
      fill: 'none',
      r: radius,
      strokeWidth: 8
    };

    let statusColor = 'teal';
    if (percent >= 0.95) {
      statusColor = 'red';
    } else if (percent >= 0.85) {
      statusColor = 'orange';
    }

    return (
      <div
        role="progressbar"
        aria-valuenow={percent * 100}
        aria-valuemin="0"
        aria-valuemax="100"
        style={{
          position: 'relative',
          margin: '24px auto',
          height: 150,
          width: 150
        }}
      >
        <svg
          style={{
            height: '100%',
            width: '100%',
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            margin: 'auto',
            transform: 'rotate(-90deg)'
          }}
          viewBox="25 25 50 50"
        >
          <circle
            {...circleProps}
            strokeWidth="9"
            style={{ stroke: 'rgba(0,0,0,0.25)' }}
          />
          <circle
            {...circleProps}
            stroke={statusColor}
            strokeDasharray={circumference}
            strokeDashoffset={percentageValue}
            style={{ transition: 'stroke-dashoffset 1s' }}
          />
        </svg>
      </div>
    );
  }
}
