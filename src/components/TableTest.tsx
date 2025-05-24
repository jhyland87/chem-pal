import React, { useState } from 'react';
import { Collapse, Typography } from '@mui/material';
import { Virtuoso } from 'react-virtuoso';

interface TableData {
  name: string;
  news: string;
}

const TableTest: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [data, setData] = useState<TableData[]>([]);
  const [currentOpenIndex, setcurrentOpenIndex] = useState<number | null>(null);

  const fetchData = () => {
    console.log('End reached - fetchData')
    console.log('currentPage', currentPage)
    const newData = [
      {
        name: `Some Name - ${data.length}`,
        news: `Some News - ${data.length}`,
      }
    ]
    setData(data => [...data, ...newData]);
    setCurrentPage(page => page + 1);

    /*
    fetch(`https://dummyapi.io/data/v1/user?limit=10&page=${currentPage}`)
      .then(response => response.json())
      .then(result => {
        setData(data => [...data, ...result.data]);
        setCurrentPage(page => page + 1);
      })
      .catch(error => console.log('error', error));
      */
  };

  return (
    <Virtuoso
      style={{ height: 1000 }}
      data={data}
      endReached={fetchData}
      itemContent={(index, data) => {
        console.log('itemContent', index, data)
        let bgColor = '';
        if (index % 2 === 0) {
          bgColor = 'yellow';
        } else {
          bgColor = 'blue';
        }

        return (
          <div style={{ background: bgColor, marginTop: 3 }}>
            <div
              style={{ height: 50 }}
              onClick={() =>
                currentOpenIndex === index ? setcurrentOpenIndex(null) : setcurrentOpenIndex(index)
              }
            >
              {data.name}
            </div>
            <Collapse in={index === currentOpenIndex} unmountOnExit>
              <Typography>{data.news}</Typography>
            </Collapse>
          </div>
        )
      }
      }
    />
  )
}

export default TableTest