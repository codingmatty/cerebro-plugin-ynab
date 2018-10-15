import React from 'react';

export default class List extends React.Component {
  render() {
    const { values } = this.props;

    return (
      <div
        style={{
          display: 'grid',
          'grid-template-columns': 'auto 1fr',
          'grid-column-gap': 12,
          'grid-row-gap': 3,
          'font-size': 18,
          'text-align': 'right',
          width: '80%'
        }}
      >
        {values.map((value, i) => (
          <div key={i}>{value}</div>
        ))}
      </div>
    );
  }
}
